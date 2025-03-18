document.addEventListener('DOMContentLoaded', () => {
    // 获取必要的DOM元素
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatMessages = document.getElementById('chat-messages');
    const newChatBtn = document.querySelector('.btn-primary');

    // 创建状态栏
    const statusBar = document.createElement('div');
    statusBar.className = 'status-bar';
    document.querySelector('main').insertBefore(statusBar, document.querySelector('main').firstChild);

    // 更新状态指示器
    function updateStatusIndicator(message, type) {
        statusBar.innerHTML = `
            <div class="status-indicator status-${type}">
                ${message}
            </div>
        `;
    }

    // 检查元素是否存在
    if (!messageInput || !sendButton || !chatMessages || !newChatBtn) {
        console.error('Required elements not found');
        return;
    }

    // 检查 Socket.IO 是否加载
    if (typeof io === 'undefined') {
        console.error('Socket.IO not loaded');
        updateStatusIndicator('Socket.IO 未能正确加载', 'danger');
        return;
    }

    // 初始化 Socket.IO 连接
    let socket;
    try {
        socket = io('http://localhost:8081', {
            transports: ['websocket'],  // 只使用 WebSocket
            upgrade: false,             // 禁用传输升级
            reconnectionAttempts: 3,    // 重连尝试次数
            timeout: 10000,            // 增加连接超时时间
            forceNew: true,            // 强制创建新连接
            path: '/socket.io'         // 指定 Socket.IO 路径
        });
    } catch (error) {
        console.error('Error initializing Socket.IO:', error);
        updateStatusIndicator('Socket.IO 连接初始化失败', 'danger');
        return;
    }

    // 更新发送按钮状态
    function updateSendButtonState(isEnabled, isLoading = false) {
        sendButton.disabled = !isEnabled || isLoading;
        sendButton.innerHTML = isLoading ? 
            '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 发送中...' : 
            '发送';
    }

    // 显示系统消息
    function showSystemMessage(message, type = 'info') {
        updateStatusIndicator(message, type === 'info' ? 'success' : type);
    }

    // 连接成功事件
    socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        updateStatusIndicator('已连接到服务器', 'success');
        updateSendButtonState(true);
    });

    // 连接错误事件
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        updateStatusIndicator('连接失败: ' + error.message, 'danger');
        updateSendButtonState(false);
    });

    // 断开连接事件
    socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        updateStatusIndicator('已断开连接: ' + reason, 'warning');
        updateSendButtonState(false);
    });

    // 重连尝试事件
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Attempting to reconnect:', attemptNumber);
        updateStatusIndicator('正在尝试重新连接...', 'info');
    });

    // 重连成功事件
    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
        updateStatusIndicator('重新连接成功', 'success');
    });

    // HTML 转义函数
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 发送消息函数
    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        // 禁用输入和发送按钮
        messageInput.disabled = true;
        updateSendButtonState(false, true);

        try {
            // 显示用户消息
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'message mb-3 user-message';
            userMessageDiv.innerHTML = `
                <div class="message-sender">我</div>
                <div class="message-content bg-white border p-3 rounded">${escapeHtml(message)}</div>
            `;
            chatMessages.appendChild(userMessageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            // 发送消息到服务器
            socket.emit('chat message', {
                type: 'text',
                content: message,
                time: new Date().getTime()
            });

            // 清空输入框
            messageInput.value = '';
        } catch (error) {
            console.error('Error sending message:', error);
            showSystemMessage('发送消息失败，请重试', 'danger');
        } finally {
            // 恢复输入和发送按钮状态
            messageInput.disabled = false;
            updateSendButtonState(true);
            messageInput.focus();
        }
    }

    // 监听输入框内容变化
    messageInput.addEventListener('input', () => {
        updateSendButtonState(messageInput.value.trim().length > 0);
    });

    // 监听回车键发送消息
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendButton.disabled) {
                sendMessage();
            }
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
        contentDiv.className = `message-content p-3 rounded ${msg.isSent ? 'bg-white border' : 'bg-light'}`;
        contentDiv.textContent = msg.content; // textContent 自动转义
        
        messageDiv.appendChild(senderDiv);
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // 新建对话按钮点击事件
    newChatBtn.addEventListener('click', () => {
        chatMessages.innerHTML = '';
        showSystemMessage('已开始新对话', 'info');
    });

    // 初始化发送按钮状态
    updateSendButtonState(false);
});

// 添加消息到聊天区域
function addMessage(sender, content) {
    const messagesDiv = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message mb-3';
    
    // 如果是用户消息，添加user-message类
    if (sender === '我') {
        messageDiv.classList.add('user-message');
    }
    
    messageDiv.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-content ${sender === '我' ? 'bg-white border' : 'bg-light'} p-3 rounded">${escapeHtml(content)}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
