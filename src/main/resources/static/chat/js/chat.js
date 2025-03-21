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
        // 如果按下Enter键且没有按下Shift键和Alt键，则发送消息
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            handleSubmit(event);
        }
        // 如果按下Enter键且按下Alt键或Shift键，则插入换行
        else if (event.key === 'Enter' && (event.altKey || event.shiftKey)) {
            event.preventDefault();
            const input = event.target;
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const value = input.value;
            const beforeCursor = value.substring(0, start);
            const afterCursor = value.substring(end);
            
            // 检查光标前后是否已经有换行符
            const needsLeadingNewline = start > 0 && beforeCursor.charAt(beforeCursor.length - 1) !== '\n';
            const needsTrailingNewline = end < value.length && afterCursor.charAt(0) !== '\n';
            
            // 根据上下文添加适当的换行符
            let newValue = beforeCursor;
            if (needsLeadingNewline) {
                newValue += '\n';
            }
            if (needsTrailingNewline) {
                newValue += '\n';
            }
            newValue += afterCursor;
            
            // 更新输入框的值
            input.value = newValue;
            
            // 将光标移动到新的位置
            const newPosition = start + (needsLeadingNewline ? 1 : 0);
            input.selectionStart = input.selectionEnd = newPosition;
            
            // 触发input事件以调整文本框高度
            input.dispatchEvent(new Event('input'));
        }
    }

    // 处理消息的显示
    function updateMessageDisplay(messageContainer, content) {
        try {
            // 调试日志：显示原始内容
            console.log('原始内容:', content);

            // 将Unicode转义序列转换回实际字符
            const decodedContent = content
                .replace(/\\u003C/g, '<')    // <
                .replace(/\\u003E/g, '>')    // >
                .replace(/\\u002F/g, '/')    // /
                .replace(/\\u0022/g, '"')    // "
                .replace(/\\u0027/g, "'")    // '
                .replace(/\\u003D/g, '=')    // =
                .replace(/\\u0020/g, ' ')    // 空格
                .replace(/\\u000A/g, '\n')   // 换行
                .replace(/\\u000D/g, '\r')   // 回车
                .replace(/\\u0009/g, '\t')   // 制表符
                .replace(/\\\\/g, '\\')      // 反斜杠
                .replace(/\\n/g, '\n');      // 换行符

            // 调试日志：显示转换后的内容
            console.log('Unicode转换后的内容:', decodedContent);
            
            // 使用marked渲染Markdown
            let renderedContent = decodedContent;
            if (typeof marked !== 'undefined') {
                // 配置marked
                marked.setOptions({
                    sanitize: false,
                    breaks: true,
                    langPrefix: 'hljs language-',
                    highlight: function(code, lang) {
                        if (typeof hljs !== 'undefined') {
                            try {
                                if (lang && hljs.getLanguage(lang)) {
                                    return hljs.highlight(code, { language: lang }).value;
                                }
                                return hljs.highlightAuto(code).value;
                            } catch (e) {
                                console.error('代码高亮出错:', e);
                                return code;
                            }
                        }
                        return code;
                    }
                });
                
                // 处理代码块
                if (decodedContent.includes('```')) {
                    // 确保代码块前后有空行
                    renderedContent = decodedContent
                        .replace(/```(\w+)?\n/g, '\n```$1\n')
                        .replace(/\n```/g, '\n```\n');
                }
                
                renderedContent = marked.parse(renderedContent);
                // 调试日志：显示Markdown渲染后的内容
                console.log('Markdown渲染后的内容:', renderedContent);
            }
            
            // 更新消息容器内容
            const contentDiv = messageContainer.querySelector('.message-content');
            if (contentDiv) {
                contentDiv.innerHTML = renderedContent;
                
                // 应用代码高亮
                if (typeof hljs !== 'undefined') {
                    contentDiv.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightBlock(block);
                    });
                }
            }
            
            // 滚动到底部
            scrollToBottom();
        } catch (error) {
            console.error('更新消息显示时出错:', error);
            console.error('原始内容:', content);
            const contentDiv = messageContainer.querySelector('.message-content');
            if (contentDiv) {
                contentDiv.textContent = content;
            }
        }
    }

    // 检查文本是否看起来像代码
    function looksLikeCode(text) {
        // 检查是否包含常见的代码特征
        const codeIndicators = [
            /^[\s]*[{}\[\]]/,           // 以括号开始
            /[;{}()\[\]]{3,}/,          // 包含多个括号或分号
            /\b(function|class|if|for|while|return|var|let|const)\b/, // 常见关键字
            /^[\s]*[a-zA-Z]+[\w\s]*\([^\)]*\)[\s]*{/,  // 函数定义
            /^[\s]*import\s+|^[\s]*export\s+/,          // import/export 语句
            /[\s]*[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/,    // 变量赋值
            /^[\s]*<[a-zA-Z]/,          // HTML标签
            /^[\s]*#include|^[\s]*#define/  // C/C++预处理指令
        ];

        return codeIndicators.some(pattern => pattern.test(text));
    }

    // 生成会话ID
    const sessionId = generateSessionId();
    
    // 发送消息并获取流式响应（POST方式）
    async function askQuestionStreamPost(question, retryCount = 3) {
        try {
            // 显示用户的问题
            addMessage(question, 'user');
            
            // 禁用输入，表示正在处理
            setInputState(false);
            showSystemMessage('正在思考...', 'info');
            
            // 发送请求
            const response = await fetch('/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    question: question,
                    sessionId: sessionId
                })
            });

            // 处理HTTP错误
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // 获取响应的文本流
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let messageContainer = null;
            let currentMessage = '';
            let buffer = '';

            // 读取流
            while (true) {
                const { value, done } = await reader.read();
                
                if (done) {
                    console.log('流读取完成');
                    break;
                }
                
                // 解码新的数据块
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                // 按行分割并处理每一行
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保存不完整的最后一行
                
                for (const line of lines) {
                    if (!line.trim()) continue;  // 跳过空行
                    
                    // 处理data行
                    if (line.startsWith('data:')) {
                        const data = line.slice(5).trim();
                        
                        // 如果是[DONE]标记，结束处理
                        if (data === '[DONE]') {
                            console.log('收到[DONE]标记，处理完成');
                            setInputState(true);
                            showSystemMessage('处理完成', 'success');
                            return;
                        }
                        
                        try {
                            // 创建消息容器（如果还没有）
                            if (!messageContainer) {
                                messageContainer = createMessageElement('assistant', '');
                                elements.chatMessages.appendChild(messageContainer);
                            }

                            // 尝试解析JSON数据
                            let content = '';
                            try {
                                const jsonData = JSON.parse(data);
                                content = jsonData.content || '';
                            } catch (jsonError) {
                                const contentMatch = data.match(/"content"\s*:\s*"([^]*?)(?<!\\)"/);
                                if (contentMatch && contentMatch[1]) {
                                    content = contentMatch[1]
                                        .replace(/\\"/g, '"')
                                        .replace(/\\\\/g, '\\')
                                        .replace(/\\n/g, '\n')
                                        .replace(/\\r/g, '\r')
                                        .replace(/\\t/g, '\t')
                                        .replace(/\\u003C/g, '<')
                                        .replace(/\\u003E/g, '>')
                                        .replace(/\\u002F/g, '/')
                                        .replace(/\\u0022/g, '"')
                                        .replace(/\\u0027/g, "'")
                                        .replace(/\\u003D/g, '=');
                                }
                            }

                            if (content) {
                                // 累加消息内容而不是覆盖
                                currentMessage += content;
                                console.log('累加的内容:', currentMessage);
                                updateMessageDisplay(messageContainer, currentMessage);
                            }
                        } catch (error) {
                            console.error('处理消息时出错:', error);
                            console.error('原始数据:', data);
                        }
                    }
                }
            }

            setInputState(true);
            showSystemMessage('处理完成', 'success');
            
        } catch (error) {
            console.error('请求出错:', error);
            showSystemMessage(error.message, 'error');
            
            // 如果还有重试次数，则重试
            if (retryCount > 0) {
                console.log(`还剩 ${retryCount} 次重试机会`);
                showSystemMessage('正在重试...', 'warning');
                return askQuestionStreamPost(question, retryCount - 1);
            }
            
            setInputState(true);
        }
    }

    // 生成会话ID
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 清除对话历史
    async function clearHistory() {
        try {
            await fetch('/chat/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    sessionId: sessionId
                })
            });
            
            // 清空消息显示区域
            elements.chatMessages.innerHTML = '';
            showSystemMessage('对话历史已清除', 'success');
            setTimeout(() => {
                showSystemMessage('', '');
            }, 2000);
        } catch (error) {
            console.error('清除历史记录时出错:', error);
            showSystemMessage('清除历史记录失败', 'error');
            setTimeout(() => {
                showSystemMessage('', '');
            }, 2000);
        }
    }

    // 处理表单提交
    async function handleSubmit(event) {
        event.preventDefault();
        const question = elements.messageInput.value.trim();
        
        if (question) {
            // 立即清空并重置输入框
            elements.messageInput.value = '';
            elements.messageInput.style.height = 'auto';
            elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 200)}px`;
            
            // 禁用输入和发送按钮
            setInputState(false);
            
            try {
                await askQuestionStreamPost(question);
            } catch (error) {
                console.error('发送消息时出错:', error);
                showSystemMessage('发送消息失败，请重试', 'error');
                setInputState(true);
            }
        }
    }

    // 处理输入框自动调整高度
    function adjustTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }

    // 监听输入框内容变化
    elements.messageInput.addEventListener('input', function() {
        adjustTextareaHeight(this);
    });

    // 监听输入框按键事件
    elements.messageInput.addEventListener('keydown', function(e) {
        handleKeyPress(e);
    });

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
        messageDiv.appendChild(contentDiv);
        
        // 用户消息使用 pre 标签保留格式，AI消息使用 Markdown 渲染
        if (type === 'user') {
            contentDiv.style.whiteSpace = 'pre-wrap';  // 保留空格和换行
            contentDiv.style.wordBreak = 'break-word'; // 确保长文本会自动换行
            contentDiv.textContent = content;
        } else {
        updateMessageDisplay(messageDiv, content);
        }
        
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

    // HTML 转义函数（用于所有需要转义的内容）
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/`/g, "&#96;"); // 转义反引号
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
                primary: '/chat/js/marked.min.js',
                fallback: 'https://cdn.jsdelivr.net/npm/marked@4.3.0/marked.min.js',
                id: 'marked-js'
            },
            {
                type: 'style',
                primary: '/chat/css/github-dark.min.css',
                fallback: 'https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/github-dark.css',
                id: 'hljs-css'
            },
            {
                type: 'script',
                primary: '/chat/js/highlight.min.js',
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
            }
        } catch (error) {
            console.error('加载外部资源失败:', error);
            showSystemMessage('部分功能可能不可用', 'warning');
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
