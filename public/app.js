// DOM Elements
const greetingPage = document.getElementById('greeting-page');
const joinRoomPage = document.getElementById('join-room-page');
const chatRoomPage = document.getElementById('chat-room-page');

const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinSubmitBtn = document.getElementById('join-submit-btn');
const joinBackBtn = document.getElementById('join-back-btn');
const closeRoomBtn = document.getElementById('close-room-btn');
const sendMessageBtn = document.getElementById('send-message-btn');
const copyRoomKeyBtn = document.getElementById('copy-room-key');

const roomKeyInput = document.getElementById('room-key-input');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const joinErrorMessage = document.getElementById('join-error-message');

const roomKeyDisplay = document.getElementById('room-key-display');
const roomKeyInfo = document.getElementById('room-key-info');
const usernameDisplay = document.getElementById('username-display');
const userCountDisplay = document.getElementById('user-count-display');
const adminControls = document.getElementById('admin-controls');

const replyContainer = document.getElementById('reply-container');
const replyUsername = document.getElementById('reply-username');
const replyMessage = document.getElementById('reply-message');
const cancelReplyBtn = document.getElementById('cancel-reply');

let currentRoom = null;
let currentUsername = null;
let isAdmin = false;
let replyingTo = null;
let messageMap = new Map();
let eventSource = null;

function showPage(page) {
    greetingPage.classList.remove('active');
    joinRoomPage.classList.remove('active');
    chatRoomPage.classList.remove('active');
    page.classList.add('active');
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMessage(messageObj, isOwnMessage = false) {
    const { username, message, timestamp, replyTo } = messageObj;
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isOwnMessage ? 'own-message' : 'other-message');
    const usernameElement = document.createElement('div');
    usernameElement.classList.add('username');
    usernameElement.textContent = username;
    if (replyTo && messageMap.has(replyTo)) {
        const repliedMessage = messageMap.get(replyTo);
        const quoteElement = document.createElement('div');
        quoteElement.classList.add('reply-quote');
        const quoteUsername = document.createElement('div');
        quoteUsername.classList.add('reply-quote-username');
        quoteUsername.textContent = repliedMessage.username;
        const quoteText = document.createElement('div');
        quoteText.textContent = repliedMessage.message.length > 50
            ? repliedMessage.message.substring(0, 50) + '...'
            : repliedMessage.message;
        quoteElement.appendChild(quoteUsername);
        quoteElement.appendChild(quoteText);
        messageElement.appendChild(quoteElement);
    }
    messageElement.appendChild(usernameElement);
    const contentElement = document.createElement('div');
    contentElement.classList.add('content');
    contentElement.textContent = message;
    messageElement.appendChild(contentElement);
    const timestampElement = document.createElement('div');
    timestampElement.classList.add('timestamp');
    timestampElement.textContent = formatTimestamp(timestamp);
    messageElement.appendChild(timestampElement);
    chatMessages.appendChild(messageElement);
    messageMap.set(timestamp, messageObj);
}

function startReply(messageId) {
    if (!messageMap.has(messageId)) return;
    const messageObj = messageMap.get(messageId);
    replyingTo = messageId;
    replyContainer.classList.add('active');
    replyUsername.textContent = messageObj.username;
    replyMessage.textContent = messageObj.message.length > 30
        ? messageObj.message.substring(0, 30) + '...'
        : messageObj.message;
    messageInput.focus();
}

function cancelReply() {
    replyingTo = null;
    replyContainer.classList.remove('active');
}

function addSystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('system-message');
    messageElement.textContent = message;
    chatMessages.appendChild(messageElement);
}

createRoomBtn.addEventListener('click', async () => {
    const response = await fetch('/api/createRoom', { method: 'POST' });
    const data = await response.json();
    currentRoom = data.roomKey;
    currentUsername = data.username;
    isAdmin = true;
    roomKeyDisplay.textContent = currentRoom;
    roomKeyInfo.textContent = currentRoom;
    usernameDisplay.textContent = currentUsername;
    adminControls.style.display = isAdmin ? 'block' : 'none';
    connectToRoom(currentRoom);
});

joinRoomBtn.addEventListener('click', () => {
    showPage(joinRoomPage);
    roomKeyInput.focus();
});

joinSubmitBtn.addEventListener('click', async () => {
    const roomKey = roomKeyInput.value.trim();
    if (roomKey.length !== 6 || !/^\d+$/.test(roomKey)) {
        joinErrorMessage.textContent = 'Please enter a valid 6-digit room key';
        return;
    }
    const response = await fetch('/api/joinRoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomKey })
    });
    if (response.ok) {
        const data = await response.json();
        currentRoom = roomKey;
        currentUsername = data.username;
        isAdmin = false;
        roomKeyDisplay.textContent = currentRoom;
        roomKeyInfo.textContent = currentRoom;
        usernameDisplay.textContent = currentUsername;
        adminControls.style.display = 'none';
        joinErrorMessage.textContent = '';
        connectToRoom(currentRoom);
    } else {
        const err = await response.json();
        joinErrorMessage.textContent = err.error || 'Failed to join room';
    }
});

joinBackBtn.addEventListener('click', () => {
    showPage(greetingPage);
    joinErrorMessage.textContent = '';
    roomKeyInput.value = '';
});

closeRoomBtn.addEventListener('click', () => {
    alert('Close room feature is not supported in this version');
});

cancelReplyBtn.addEventListener('click', () => {
    cancelReply();
});

sendMessageBtn.addEventListener('click', () => {
    sendMessage();
});

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

copyRoomKeyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoom)
        .then(() => {
            alert('Room key copied to clipboard!');
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
        });
});

async function sendMessage() {
    const message = messageInput.value.trim();
    if (message && currentRoom) {
        await fetch('/api/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomKey: currentRoom,
                username: currentUsername,
                message: message,
                replyTo: replyingTo
            })
        });
        messageInput.value = '';
        messageInput.focus();
        if (replyingTo) cancelReply();
    }
}

function connectToRoom(roomKey) {
    if (eventSource) {
        eventSource.close();
    }
    showPage(chatRoomPage);
    eventSource = new EventSource(`/api/stream/${roomKey}`);
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const isOwnMessage = data.username === currentUsername;
        addMessage(data, isOwnMessage);
    };
}

showPage(greetingPage);
