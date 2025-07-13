const express = require('express');
const cors = require('cors');
const path = require('path');
const captchaRouter = require('./captcha');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(captchaRouter); // import router captcha

const rooms = new Map();
const clients = new Map();

function generateRoomKey() {
  let key;
  do {
    key = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(key));
  return key;
}

function generateUsername() {
  const adjectives = ['Red', 'Blue', 'Green', 'Yellow'];
  const animals = ['Tiger', 'Fox', 'Bear', 'Wolf'];
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}-${animals[Math.floor(Math.random() * animals.length)]}`;
}

app.post('/api/createRoom', (req, res) => {
  const roomKey = generateRoomKey();
  const username = generateUsername();
  rooms.set(roomKey, { users: [username], messages: [] });
  res.json({ roomKey, username });
});

app.post('/api/joinRoom', (req, res) => {
  const { roomKey } = req.body;
  if (!rooms.has(roomKey)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const username = generateUsername();
  rooms.get(roomKey).users.push(username);
  res.json({ username });
});

app.post('/api/sendMessage', (req, res) => {
  const { roomKey, username, message } = req.body;
  if (!rooms.has(roomKey)) {
    return res.status(404).json({ error: 'Room not found' });
  }
  const msg = { username, message, timestamp: Date.now() };
  rooms.get(roomKey).messages.push(msg);
  if (clients.has(roomKey)) {
    clients.get(roomKey).forEach(clientRes => {
      clientRes.write(`data: ${JSON.stringify(msg)}\n\n`);
    });
  }
  res.json({ success: true });
});

app.get('/api/stream/:roomKey', (req, res) => {
  const { roomKey } = req.params;
  if (!rooms.has(roomKey)) {
    return res.status(404).end();
  }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders();
  const history = rooms.get(roomKey).messages;
  history.forEach(msg => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  });
  if (!clients.has(roomKey)) {
    clients.set(roomKey, []);
  }
  clients.get(roomKey).push(res);
  req.on('close', () => {
    const updatedClients = clients.get(roomKey).filter(c => c !== res);
    clients.set(roomKey, updatedClients);
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

module.exports = app;
