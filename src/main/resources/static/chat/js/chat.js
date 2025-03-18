document.addEventListener('DOMContentLoaded', () => {
    // 使用事件委托处理所有点击事件
    document.addEventListener('click', handleGlobalClick);
    
    // 获取必要的DOM元素
    const elements = {
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        chatMessages: document.getElementById('chat-messages'),
        chatForm: document.getElementById('chat-form'),
        sidebar: document.querySelector('.sidebar'),
        sidebarToggle: document.querySelector('.sidebar-toggle'),
        sidebarBackdrop: document.querySelector('.sidebar-backdrop'),
        statusBar: document.querySelector('.status-bar')
    };

    // 初始化
    initializeChat();

    // 全局点击事件处理
    function handleGlobalClick(event) {
        const target = event.target;

        // 处理新对话按钮点击
        if (target.closest('.btn-primary')) {
            startNewChat();
        }

        // 处理历史对话点击
        if (target.closest('.list-unstyled a')) {
            loadHistoryChat(target.closest('a').dataset.chatId);
        }

        // 处理侧边栏切换
        if (target.closest('.sidebar-toggle') || target.closest('.sidebar-backdrop')) {
            toggleSidebar();
        }
    }

    // 初始化聊天功能
    function initializeChat() {
        // 自动聚焦输入框
        focusInput();

        // 设置输入框事件监听
        elements.messageInput.addEventListener('input', handleInput);
        elements.messageInput.addEventListener('keydown', handleKeyPress);
        
        // 移除自动重新聚焦的行为
        // elements.messageInput.addEventListener('blur', () => {
        //     if (!window.matchMedia('(max-width: 768px)').matches) {
        //         setTimeout(focusInput, 100);
        //     }
        // });

        // 设置表单提交事件
        elements.chatForm.addEventListener('submit', handleSubmit);

        // 设置消息观察器
        setupMessageObserver();

        // 初始化 Socket.IO
        initializeSocketIO();
    }

    // 聚焦输入框
    function focusInput() {
        // 只在页面加载和发送消息后聚焦
        if (!elements.messageInput.disabled && !isUserSelecting()) {
            elements.messageInput.focus();
        }
    }

    // 检查用户是否正在选择文本
    function isUserSelecting() {
        const selection = window.getSelection();
        return selection && selection.toString().length > 0;
    }

    // 处理输入框事件
    function handleInput(event) {
        const input = event.target;
        
        // 自动调整高度
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
        
        // 更新发送按钮状态
        elements.sendButton.disabled = !input.value.trim();
    }

    // 处理键盘事件
    function handleKeyPress(event) {
        // Alt + Enter 换行
        if (event.key === 'Enter' && event.altKey) {
            event.preventDefault();
            const start = event.target.selectionStart;
            const end = event.target.selectionEnd;
            const value = event.target.value;
            event.target.value = value.substring(0, start) + '\n' + value.substring(end);
            event.target.selectionStart = event.target.selectionEnd = start + 1;
            return;
        }
        
        // Enter 发送消息
        if (event.key === 'Enter' && !event.altKey && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
        }
    }

    // 处理表单提交
    async function handleSubmit(event) {
        event.preventDefault();
        const message = elements.messageInput.value.trim();
        if (!message || elements.sendButton.disabled) return;

        try {
            await sendMessage(message);
        } catch (error) {
            console.error('发送消息失败:', error);
            showSystemMessage('发送消息失败: ' + error.message, 'danger');
        }
    }

    // 发送消息
    async function sendMessage(message) {
        // 禁用输入
        setInputState(false);
        
        // 显示用户消息
        addMessage(message, true);
        
        try {
            const response = await fetch(`http://localhost:8080/chat/asks?question=${encodeURIComponent(message)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            // 处理流式响应
            await handleStreamResponse(response);
            
        } finally {
            // 重置输入状态
            setInputState(true);
        }
    }

    // 设置输入状态
    function setInputState(enabled) {
        elements.messageInput.disabled = !enabled;
        elements.sendButton.disabled = !enabled;
        if (enabled) {
            elements.messageInput.value = '';
            elements.messageInput.style.height = 'auto';
            // 只在发送消息后聚焦
            focusInput();
        }
    }

    // 处理流式响应
    async function handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let messageDiv = null;
        let responseText = '';

        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                responseText += chunk;

                // 创建或更新消息
                if (!messageDiv) {
                    messageDiv = createMessageElement('DeepSeek', responseText);
                    elements.chatMessages.appendChild(messageDiv);
                } else {
                    updateMessageContent(messageDiv, responseText);
                }
            }
        } catch (error) {
            console.error('读取响应流失败:', error);
            if (messageDiv) {
                updateMessageContent(messageDiv, '读取响应时发生错误，请重试。', true);
            }
        }
    }

    // 创建消息元素
    function createMessageElement(sender, content, isUser = false) {
        const div = document.createElement('div');
        div.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
        div.innerHTML = `
            <div class="message-sender">${sender}</div>
            <div class="message-content">${content}</div>
        `;
        return div;
    }

    // 添加消息到聊天区域
    function addMessage(content, isUser = false) {
        const messageDiv = createMessageElement(isUser ? '用户' : 'DeepSeek', content, isUser);
        elements.chatMessages.appendChild(messageDiv);
        scrollToBottom();
    }

    // 更新消息内容
    function updateMessageContent(messageDiv, content, isError = false) {
        const contentDiv = messageDiv.querySelector('.message-content');
        contentDiv.innerHTML = isError ? escapeHtml(content) : content;
        if (isError) {
            messageDiv.classList.add('error-message');
        }
    }

    // 设置消息观察器
    function setupMessageObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldScroll = false;
            
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    shouldScroll = true;
                }
            });

            if (shouldScroll) {
                // 使用 requestAnimationFrame 确保在DOM更新后滚动
                requestAnimationFrame(() => {
                    scrollToBottom(true);
                });
            }
        });

        observer.observe(elements.chatMessages, { 
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    // 滚动到底部
    function scrollToBottom(smooth = true) {
        const chatMessages = elements.chatMessages;
        const lastMessage = chatMessages.lastElementChild;
        
        if (lastMessage) {
            const containerHeight = chatMessages.clientHeight;
            const scrollTop = chatMessages.scrollTop;
            const scrollHeight = chatMessages.scrollHeight;
            const messageHeight = lastMessage.offsetHeight;
            const isNearBottom = (scrollHeight - scrollTop - containerHeight) < messageHeight * 2;

            // 只有当用户已经在接近底部时才自动滚动
            if (isNearBottom) {
                chatMessages.scrollTo({
                    top: scrollHeight,
                    behavior: smooth ? 'smooth' : 'auto'
                });
            }
        }
    }

    // HTML 转义（仅用于错误消息）
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // 显示系统消息
    function showSystemMessage(message, type = 'info') {
        elements.statusBar.innerHTML = `
            <div class="status-indicator status-${type}">
                ${message}
            </div>
        `;
    }

    // 切换侧边栏
    function toggleSidebar() {
        elements.sidebar.classList.toggle('show');
        elements.sidebarBackdrop.classList.toggle('show');
        document.body.style.overflow = elements.sidebar.classList.contains('show') ? 'hidden' : '';
    }

    // 开始新对话
    function startNewChat() {
        elements.chatMessages.innerHTML = '';
        showSystemMessage('开始新对话', 'info');
    }

    // 加载历史对话
    function loadHistoryChat(chatId) {
        // TODO: 实现历史对话加载逻辑
        console.log('加载历史对话:', chatId);
    }

    // 初始化 Socket.IO 连接
    function initializeSocketIO() {
        // 检查 Socket.IO 是否加载
        if (typeof io === 'undefined') {
            console.error('Socket.IO not loaded');
            showSystemMessage('Socket.IO 未能正确加载', 'danger');
            return;
        }

        // 获取当前主机和端口
        const currentHost = window.location.hostname;
        const socketPort = '8081'; // Socket.IO 服务器端口

        try {
            const socket = io(`http://${currentHost}:${socketPort}`, {
                transports: ['websocket', 'polling'], // 允许降级到轮询
                upgrade: true,                        // 允许传输升级
                reconnectionAttempts: 5,              // 增加重连次数
                reconnectionDelay: 1000,              // 重连延迟
                timeout: 20000,                       // 增加超时时间
                forceNew: true,
                path: '/static/socket.io'
            });

            // 添加连接事件监听
            socket.on('connect_error', (error) => {
                console.error('连接错误:', error);
                if (error.message.includes('xhr poll error')) {
                    // 如果是轮询错误，尝试切换到 WebSocket
                    socket.io.opts.transports = ['websocket'];
                }
                showSystemMessage(`连接失败: ${error.message}`, 'danger');
            });

            socket.io.on('error', (error) => {
                console.error('传输错误:', error);
                showSystemMessage('网络连接不稳定，请检查网络设置', 'warning');
            });

            socket.io.on('reconnect_attempt', (attempt) => {
                console.log(`第 ${attempt} 次重连尝试`);
                showSystemMessage(`正在尝试重新连接(${attempt}/5)...`, 'warning');
            });

            socket.io.on('reconnect_failed', () => {
                console.error('重连失败');
                showSystemMessage('无法连接到服务器，请刷新页面重试', 'danger');
            });

            // 连接成功事件
            socket.on('connect', () => {
                console.log('Connected to Socket.IO server');
                showSystemMessage('已连接到服务器', 'success');
                setInputState(true);
            });

            // 断开连接事件
            socket.on('disconnect', (reason) => {
                console.log('Disconnected:', reason);
                showSystemMessage(`已断开连接: ${reason}`, 'warning');
                setInputState(false);
            });

            // 重连成功事件
            socket.on('reconnect', (attemptNumber) => {
                console.log('Reconnected after', attemptNumber, 'attempts');
                showSystemMessage('重新连接成功', 'success');
            });

        } catch (error) {
            console.error('Error initializing Socket.IO:', error);
            showSystemMessage('Socket.IO 连接初始化失败', 'danger');
        }
    }
});
