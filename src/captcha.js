const express = require('express');
const axios = require('axios');

const captchaRouter = express.Router();
const secretKey = '0x4AAAAAABk6Nhato5D8hXxxZfu9GgRep7E';

captchaRouter.post('/api/verifyCaptcha', async (req, res) => {
  const token = req.body['cf-turnstile-response'];
  if (!token) {
    return res.status(400).json({ error: 'Missing captcha token' });
  }
  try {
    const response = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      new URLSearchParams({
        secret: secretKey,
        response: token
      })
    );
    if (response.data.success) {
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'Invalid captcha token' });
    }
  } catch {
    res.status(500).json({ error: 'Error verifying captcha' });
  }
});

module.exports = captchaRouter;
