const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware setup
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

const captchaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 captcha attempts per windowMs
    message: 'Too many captcha attempts, please try again later.'
});

app.use('/api/', limiter);
app.use('/api/verify-captcha', captchaLimiter);

// Cloudflare Turnstile configuration
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || 'your-turnstile-secret-key';
const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || 'your-turnstile-site-key';

// Data storage
const rooms = new Map();
const clients = new Map();

// Helper functions
function generateRoomKey() {
    let key;
    do {
        key = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms.has(key));
    return key;
}

function generateUsername() {
    const adjectives = ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Pink', 'Brown'];
    const animals = ['Tiger', 'Fox', 'Bear', 'Wolf', 'Lion', 'Eagle', 'Shark', 'Panda'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}-${animals[Math.floor(Math.random() * animals.length)]}`;
}

// Middleware to check CAPTCHA verification
function requireCaptchaVerification(req, res, next) {
    if (!req.session.captchaVerified) {
        return res.status(401).json({ 
            error: 'CAPTCHA verification required',
            requiresVerification: true 
        });
    }
    next();
}

// CAPTCHA verification endpoint
app.post('/api/verify-captcha', async (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ 
            success: false, 
            error: 'CAPTCHA token is required' 
        });
    }

    try {
        // Verify token with Cloudflare Turnstile
        const response = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            secret: TURNSTILE_SECRET_KEY,
            response: token,
            remoteip: req.ip
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        });

        const data = response.data;
        
        if (data.success) {
            // Store verification in session
            req.session.captchaVerified = true;
            req.session.captchaTimestamp = Date.now();
            
            // Log successful verification
            console.log(`CAPTCHA verified for IP: ${req.ip} at ${new Date()}`);
            
            res.json({ 
                success: true, 
                message: 'CAPTCHA verification successful' 
            });
        } else {
            console.log(`CAPTCHA verification failed for IP: ${req.ip}`, data);
            res.status(400).json({ 
                success: false, 
                error: 'CAPTCHA verification failed',
                details: data['error-codes'] || []
            });
        }
    } catch (error) {
        console.error('CAPTCHA verification error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error during verification' 
        });
    }
});

// Check verification status endpoint
app.get('/api/check-verification', (req, res) => {
    const isVerified = req.session.captchaVerified === true;
    const timestamp = req.session.captchaTimestamp;
    
    // Check if verification is still valid (within 24 hours)
    if (isVerified && timestamp) {
        const now = Date.now();
        const verificationAge = now - timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (verificationAge > maxAge) {
            // Verification expired
            req.session.captchaVerified = false;
            req.session.captchaTimestamp = null;
            return res.json({ verified: false, reason: 'expired' });
        }
    }
    
    res.json({
