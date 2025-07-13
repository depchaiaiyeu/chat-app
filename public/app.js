// App state
let currentRoom = null;
let currentUsername = null;
let isAdmin = false;
let replyingTo = null;
let messageMap = new Map(); // Store messages by ID for reply functionality

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

// Helper functions
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
    const { id, username, message, timestamp, replyTo } = messageObj;
    messageMap.set(id, messageObj);

    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    messageElement.classList.add(isOwnMessage ? 'own-message' : 'other-message');
    messageElement.dataset.messageId = id;

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

    // Enable swipe to reply
    const hammer = new Hammer(messageElement);
    hammer.on('swiperight', function () {
        startReply(id);
    });
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

// API calls
async function apiRequest(path, method = 'GET', data) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) options.body = JSON.stringify(data);
    const res = await fetch(path, options);
    return res.json();
}

// Event listeners
createRoomBtn.addEventListener('click', async () => {
    const res = await apiRequest('/createRoom', 'POST');
    if (res.roomKey) enterRoom(res);
});

joinRoomBtn.addEventListener('click', () => {
    showPage(joinRoomPage);
    roomKeyInput.focus();
});

joinSubmitBtn.addEventListener('click', async () => {
    const roomKey = roomKeyInput.value.trim();
    if (roomKey.length !== 6 || !/^\d+$/.test(roomKey)) {
        joinErrorMessage.textContent = 'Vui lòng nhập đúng mã phòng 6 chữ số';
        return;
    }
    const res = await apiRequest('/joinRoom', 'POST', { roomKey });
    if (res.error) {
        joinErrorMessage.textContent = res.error;
    } else {
        enterRoom(res);
    }
});

joinBackBtn.addEventListener('click', () => {
    showPage(greetingPage);
    joinErrorMessage.textContent = '';
    roomKeyInput.value = '';
});

closeRoomBtn.addEventListener('click', async () => {
    if (confirm('Bạn có chắc muốn đóng phòng này không?')) {
        await apiRequest(`/closeRoom/${currentRoom}`, 'DELETE');
        alert('Phòng đã được đóng');
        location.reload();
    }
});

cancelReplyBtn.addEventListener('click', cancelReply);

sendMessageBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

copyRoomKeyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoom)
        .then(() => alert('Đã sao chép mã phòng!'))
        .catch(() => alert('Không thể sao chép mã phòng'));
});

usernameDisplay.addEventListener('click', () => {
    const newName = prompt('Nhập tên mới:');
    if (newName && newName.trim().length > 0) {
        apiRequest('/updateName', 'POST', { roomKey: currentRoom, newName: newName.trim() })
            .then(() => {
                currentUsername = newName.trim();
                usernameDisplay.textContent = currentUsername;
            });
    }
});

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && currentRoom) {
        apiRequest('/sendMessage', 'POST', {
            roomKey: currentRoom,
            message,
            replyTo: replyingTo
        });
        messageInput.value = '';
        cancelReply();
    }
}

function enterRoom(data) {
    currentRoom = data.roomKey;
    currentUsername = data.username;
    isAdmin = data.isAdmin;

    roomKeyDisplay.textContent = currentRoom;
    roomKeyInfo.textContent = currentRoom;
    usernameDisplay.textContent = currentUsername;
    userCountDisplay.textContent = data.userCount;
    adminControls.style.display = isAdmin ? 'block' : 'none';
    messageMap.clear();

    if (data.messages) {
        data.messages.forEach(msg => addMessage(msg, msg.username === currentUsername));
    }

    showPage(chatRoomPage);
    messageInput.focus();

    listenForUpdates();
}

function listenForUpdates() {
    const eventSource = new EventSource(`/stream/${currentRoom}`);
    eventSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'newMessage') {
            const isOwnMessage = data.username === currentUsername;
            addMessage(data, isOwnMessage);
        }
        if (data.type === 'userJoined') {
            addSystemMessage(`${data.username} đã tham gia phòng`);
            userCountDisplay.textContent = data.userCount;
        }
        if (data.type === 'userLeft') {
            addSystemMessage(`${data.username} đã rời phòng`);
            userCountDisplay.textContent = data.userCount;
        }
        if (data.type === 'roomClosed') {
            alert('Phòng đã bị đóng');
            location.reload();
        }
    };
}

// Init
showPage(greetingPage);
