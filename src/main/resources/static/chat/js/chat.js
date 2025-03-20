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

        // 加载外部资源
        loadExternalResources();
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

    // 处理消息的显示
    function updateMessageDisplay(messageContainer, content) {
        try {
            // 解码HTML实体
            const decodedContent = decodeHtmlEntities(content);
            
            // 使用marked渲染Markdown
            let renderedContent = content;
            if (typeof marked !== 'undefined') {
                renderedContent = marked.parse(decodedContent);
            }
            
            // 更新消息容器内容
            const contentDiv = messageContainer.querySelector('.message-content') || messageContainer;
            contentDiv.innerHTML = renderedContent;
            
            // 应用代码高亮
            if (typeof hljs !== 'undefined') {
                contentDiv.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightBlock(block);
                });
            }
            
            // 滚动到底部
            scrollToBottom();
        } catch (error) {
            console.error('更新消息显示时出错:', error);
            messageContainer.innerHTML = `<div class="message-content">${content}</div>`;
        }
    }

    // 发送消息并获取流式响应（POST方式）
    async function askQuestionStreamPost(question) {
        try {
            // 显示用户的问题
            addMessage(question, 'user');
            
            // 禁用输入，表示正在处理
            setInputState(false);
            showSystemMessage('正在处理您的请求...', 'info');
            
            // 发送请求
            const response = await fetch('/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: question })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let messageContainer = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();
                    
                    // 跳过空行
                    if (line === '') continue;
                    
                    // 处理data行，移除所有"data:"前缀
                    while (line.startsWith('data:')) {
                        line = line.slice(5).trim();
                    }
                    
                    // 如果是[DONE]标记，结束处理
                    if (line === '[DONE]') {
                        console.log('收到[DONE]标记，处理完成');
                        setInputState(true);
                        showSystemMessage('处理完成', 'success');
                        continue;
                    }
                    
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed && parsed.content) {
                            // 如果是第一条消息，创建新的消息容器
                            if (!messageContainer) {
                                messageContainer = addMessage('', 'assistant');
                            }
                            
                            // 更新消息显示
                            updateMessageDisplay(messageContainer, parsed.content);
                        }
                    } catch (e) {
                        // 忽略[DONE]标记的解析错误
                        if (line !== '[DONE]') {
                            console.error('解析消息时出错:', e, '原始行:', line);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('处理请求时出错:', error);
            showSystemMessage(`处理请求时出错: ${error.message}`, 'error');
        } finally {
            // 确保重置输入状态
            setInputState(true);
        }
    }

    // 修改handleSubmit函数，添加POST方式的支持
    async function handleSubmit(e) {
        e.preventDefault();
        
        const message = elements.messageInput.value.trim();
        if (!message) return;
        
        // 清空输入框
        elements.messageInput.value = '';
        
        // 使用POST方式发送消息
        await askQuestionStreamPost(message);
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
    function addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        // 添加发送者标识
        const senderDiv = document.createElement('div');
        senderDiv.className = 'message-sender';
        senderDiv.textContent = type === 'user' ? '用户' : 'DeepSeek';
        messageDiv.appendChild(senderDiv);
        
        // 添加消息内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // 根据消息类型处理内容
        if (type === 'user') {
            contentDiv.textContent = content;
        } else {
            // AI消息可能包含markdown，所以使用innerHTML
            contentDiv.innerHTML = content;
        }
        
        messageDiv.appendChild(contentDiv);
        elements.chatMessages.appendChild(messageDiv);
        scrollToBottom();
        return messageDiv;
    }

    // 添加消息到聊天区域（简单版本）
    function appendMessage(content) {
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message';
        
        // 创建一个临时元素来解码HTML实体
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .replace(/&#47;/g, "/");
        
        // 获取解码后的文本
        messageContainer.innerHTML = tempDiv.innerHTML;
        
        elements.chatMessages.appendChild(messageContainer);
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    function decodeHtmlEntities(text) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        return tempDiv.textContent;
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
            console.error('Socket.IO 未能加载，将尝试继续使用其他方式通信');
            showSystemMessage('Socket.IO 未能正确加载，但您仍然可以使用基本功能', 'warning');
            return;
        }

        // 获取当前主机和端口
        const currentHost = window.location.hostname;
        const socketPort = '8081'; // Socket.IO 服务器端口

        try {
            console.log(`尝试连接Socket.IO服务器: ${currentHost}:${socketPort}`);
            const socket = io(`http://${currentHost}:${socketPort}`, {
                transports: ['websocket', 'polling'], // 允许降级到轮询
                upgrade: true,                        // 允许传输升级
                reconnectionAttempts: 5,              // 增加重连次数
                reconnectionDelay: 1000,              // 重连延迟
                timeout: 20000,                       // 增加超时时间
                forceNew: true,
                path: '/socket.io'
            });

            // 添加连接事件监听
            socket.on('connect_error', (error) => {
                console.error('连接错误:', error);
                if (error.message.includes('xhr poll error')) {
                    // 如果是轮询错误，尝试切换到 WebSocket
                    socket.io.opts.transports = ['websocket'];
                }
                showSystemMessage(`无法连接到实时通讯服务器，但基本功能仍然可用`, 'warning');
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
                showSystemMessage('无法连接到服务器，但您仍然可以使用基本功能', 'warning');
            });

            // 连接成功事件
            socket.on('connect', () => {
                console.log('Connected to Socket.IO server');
                showSystemMessage('已连接到实时通讯服务器', 'success');
                setInputState(true);
            });

            // 断开连接事件
            socket.on('disconnect', (reason) => {
                console.log('Disconnected:', reason);
                showSystemMessage(`已断开连接，但基本功能仍然可用`, 'warning');
            });

            // 重连成功事件
            socket.on('reconnect', (attemptNumber) => {
                console.log('Reconnected after', attemptNumber, 'attempts');
                showSystemMessage('重新连接成功', 'success');
            });

            window.chatSocket = socket; // 存储socket以便其他函数访问
            return socket;

        } catch (error) {
            console.error('Error initializing Socket.IO:', error);
            showSystemMessage('实时通讯连接初始化失败，但基本功能仍然可用', 'warning');
            return null;
        }
    }

    // 加载外部资源的函数
    async function loadExternalResources() {
        const resources = [
            {
                type: 'script',
                primary: 'https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js',
                fallback: 'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js',
                id: 'marked-js'
            },
            {
                type: 'style',
                primary: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github-dark.min.css',
                fallback: 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/github-dark.css',
                id: 'hljs-css'
            },
            {
                type: 'script',
                primary: 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js',
                fallback: 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/highlight.min.js',
                id: 'hljs-js'
            }
        ];

        try {
            for (const resource of resources) {
                await loadResource(resource);
            }

            // 配置marked选项
            if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
                marked.setOptions({
                    highlight: function(code, lang) {
                        if (lang && hljs.getLanguage(lang)) {
                            return hljs.highlight(code, { language: lang }).value;
                        }
                        return hljs.highlightAuto(code).value;
                    },
                    breaks: true,
                    gfm: true,
                    headerIds: true,
                    mangle: false,
                    sanitize: false
                });
                console.log('Markdown和代码高亮功能已加载');
            } else {
                console.error('Marked or Highlight.js failed to load');
                showSystemMessage('代码高亮功能加载失败', 'warning');
            }
        } catch (error) {
            console.error('Failed to load external resources:', error);
            showSystemMessage('外部资源加载失败，部分功能可能不可用', 'warning');
        }
    }

    // 加载单个资源的函数
    function loadResource(resource) {
        return new Promise((resolve, reject) => {
            const element = document.createElement(resource.type === 'script' ? 'script' : 'link');
            
            if (resource.type === 'script') {
                element.src = resource.primary;
            } else {
                element.rel = 'stylesheet';
                element.href = resource.primary;
            }
            
            element.id = resource.id;

            element.onload = () => resolve();
            element.onerror = () => {
                console.warn(`Primary ${resource.type} failed to load, trying fallback...`);
                if (resource.type === 'script') {
                    element.src = resource.fallback;
                } else {
                    element.href = resource.fallback;
                }
                element.onerror = () => reject(new Error(`Both primary and fallback ${resource.type} failed to load`));
            };

            document.head.appendChild(element);
        });
    }

    // 渲染Markdown内容的函数
    function renderMarkdown(content) {
        try {
            if (typeof marked === 'undefined') {
                console.error('Marked is not loaded');
                return content;
            }
            return marked.parse(content);
        } catch (error) {
            console.error('Error rendering markdown:', error);
            return content;
        }
    }
});
