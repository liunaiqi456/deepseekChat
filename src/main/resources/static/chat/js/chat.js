document.addEventListener('DOMContentLoaded', () => {
    // 获取必要的DOM元素
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const newChatBtn = document.querySelector('.btn-primary');

    // 检查元素是否存在
    if (!messageInput || !sendButton || !chatMessages || !newChatBtn) {
        console.error('Required elements not found');
        return;
    }

    // 初始化 Socket.IO 连接
    const socket = io('http://localhost:8081', {
        transports: ['websocket'],
        upgrade: false,
        path: '/socket.io'
    });

    // 连接成功事件
    socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        // 显示连接状态
        const statusDiv = document.createElement('div');
        statusDiv.className = 'message mb-3';
        statusDiv.innerHTML = '<div class="message-content bg-success text-white p-3 rounded">已连接到服务器</div>';
        chatMessages.appendChild(statusDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // 连接错误事件
    socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
    });

    // 发送消息函数
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            socket.emit('chat message', {
                type: 'text',
                content: message,
                time: new Date().getTime()
            });
            messageInput.value = '';
        }
    }

    // 监听回车键发送消息
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 监听发送按钮点击事件
    sendButton.addEventListener('click', sendMessage);

    // 接收消息
    socket.on('chat message', (msg) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message mb-3';
        
        const senderDiv = document.createElement('div');
        senderDiv.className = 'message-sender';
        senderDiv.textContent = msg.isSent ? '我' : 'DeepSeek';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = `message-content p-3 rounded ${msg.isSent ? 'bg-primary text-white' : 'bg-light'}`;
        contentDiv.textContent = msg.content;
        
        messageDiv.appendChild(senderDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // 新建对话按钮点击事件
    newChatBtn.addEventListener('click', () => {
        chatMessages.innerHTML = '';
    });
});
