// VConsole初始化
let vConsole = null;
try {
    if (typeof VConsole !== 'undefined') {
        vConsole = new VConsole({
            defaultPlugins: ['system', 'network', 'element', 'storage'],
            maxLogNumber: 1000,
            onReady: function() {
                console.log('VConsole is ready.');
            }
        });
    }
} catch (error) {
    console.warn('VConsole initialization failed:', error);
}

document.addEventListener('DOMContentLoaded', () => {
    // 获取必要的DOM元素
    const elements = {
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        chatMessages: document.getElementById('chat-messages'),
        chatForm: document.getElementById('chat-form'),
        sidebar: document.querySelector('.sidebar'),
        sidebarToggle: document.querySelector('.sidebar-toggle'),
        sidebarBackdrop: document.querySelector('.sidebar-backdrop'),
        statusBar: document.querySelector('.status-bar'),
        addButton: document.getElementById('add-button'),
        uploadMenu: document.getElementById('upload-menu'),
        uploadFileOption: document.getElementById('upload-file-option'),
        fileUpload: document.getElementById('file-upload')
    };

    // 用于存储聊天历史的键
    const CHAT_HISTORY_KEY = 'deepseek_chat_history';

    // 获取当前URL中的会话ID - 使用let而不是const，使其可以修改
    let sessionId = getSessionIdFromUrl() || generateSessionId();
    
    // 设置初始历史状态
    if (sessionId && !window.history.state) {
        const currentUrl = window.location.href;
        window.history.replaceState({ sessionId: sessionId }, '', currentUrl);
    }
    
    // 加载历史对话列表
    loadChatHistoryList();
    
    // 将会话ID添加到侧边栏历史记录（如果不在历史记录中）
    if (sessionId) {
        addChatToHistory('新对话', sessionId);
    }

    // 获取URL中的会话ID
    function getSessionIdFromUrl() {
        const path = window.location.pathname;
        const matches = path.match(/\/chat\/s\/([\w-]+)/);
        return matches ? matches[1] : null;
    }

    // 加载历史对话列表
    function loadChatHistoryList() {
        try {
            // 从localStorage获取历史对话列表
            const historyJSON = localStorage.getItem(CHAT_HISTORY_KEY);
            if (historyJSON) {
                const history = JSON.parse(historyJSON);
                
                // 清空现有列表
                const historyList = document.querySelector('.history-nav ul');
                if (historyList) {
                    historyList.innerHTML = '';
                }
                
                // 检查当前会话是否在历史记录中
                let sessionFound = false;
                
                // 遍历历史记录并添加到侧边栏
                if (history.length > 0) {
                    history.forEach(chat => {
                        // 检查是否为当前会话
                        const isActive = chat.id === sessionId;
                        if (isActive) {
                            sessionFound = true;
                        }
                        addChatToHistory(chat.title || '新对话', chat.id, isActive, false); // 最后一个参数false表示不保存到localStorage
                    });
                    
                    console.log('已从本地存储加载', history.length, '个历史对话');
                }
                
                // 如果当前会话不在历史记录中，添加它
                if (!sessionFound && sessionId) {
                    addChatToHistory('新对话', sessionId, true, true);
                }
            } else {
                // 如果没有历史记录，添加当前会话
                if (sessionId) {
                    addChatToHistory('新对话', sessionId, true, true);
                }
            }
        } catch (error) {
            console.error('加载历史对话失败:', error);
            // 出错时，至少添加当前会话
            if (sessionId) {
                addChatToHistory('新对话', sessionId, true, true);
            }
        }
    }

    // 保存历史对话列表到localStorage
    function saveChatHistoryList() {
        try {
            // 获取所有对话链接
            const chatLinks = document.querySelectorAll('.chat-link');
            const history = [];
            
            // 遍历链接并构建历史记录数组
            chatLinks.forEach(link => {
                const id = link.getAttribute('data-chat-id');
                // 提取链接文本（排除删除按钮的文本）
                const titleEl = link.cloneNode(true);
                const deleteBtn = titleEl.querySelector('.delete-chat-btn');
                if (deleteBtn) {
                    deleteBtn.remove();
                }
                const title = titleEl.textContent.trim();
                
                history.push({
                    id: id,
                    title: title || '新对话'
                });
            });
            
            // 保存到localStorage
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
            console.log('已保存', history.length, '个对话到本地存储');
        } catch (error) {
            console.error('保存历史对话失败:', error);
        }
    }

    // 添加对话到历史列表
    function addChatToHistory(chatName, sessionId, isActive = true, shouldSave = true) {
        const historyList = document.querySelector('.history-nav ul');
        if (!historyList) return;
        
        console.log('添加会话到历史记录:', chatName, sessionId); // 调试输出
        
        // 检查是否已存在此会话ID的对话
        const existingChat = document.querySelector(`.chat-link[data-chat-id="${sessionId}"]`);
        if (existingChat) {
            // 如果已存在，只更新active状态
            if (isActive) {
                document.querySelectorAll('.chat-link').forEach(link => {
                    link.classList.remove('active');
                });
                existingChat.classList.add('active');
            }
            return;
        }

        const chatItem = document.createElement('li');
        chatItem.className = 'chat-item';

        const chatLink = document.createElement('a');
        chatLink.href = `/chat/s/${sessionId}`;
        chatLink.className = 'chat-link';
        if (isActive) chatLink.classList.add('active');
        chatLink.setAttribute('data-chat-id', sessionId); // 确保设置data-chat-id属性
        chatLink.textContent = chatName;

        // 添加会话管理按钮
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-chat-btn';
        deleteButton.innerHTML = '&times;';
        deleteButton.title = '删除此对话';
        deleteButton.setAttribute('aria-label', '删除对话');
        deleteButton.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            deleteChatHistory(sessionId, chatItem);
            return false; // 阻止事件冒泡
        };

        chatLink.appendChild(deleteButton);
        chatItem.appendChild(chatLink);
        
        // 将新会话添加到列表顶部
        if (historyList.firstChild) {
            historyList.insertBefore(chatItem, historyList.firstChild);
        } else {
            historyList.appendChild(chatItem);
        }
        
        // 保存到localStorage
        if (shouldSave) {
            saveChatHistoryList();
        }
    }

    // 删除会话历史
    async function deleteChatHistory(chatId, chatItem) {
        const confirmDelete = window.confirm('确定要删除这个对话吗？');
        if (!confirmDelete) return;
        
        try {
            // 从DOM中移除
            chatItem.remove();
            
            // 如果删除的是当前会话，检查是否有其他会话可以切换到
            if (chatId === sessionId) {
                // 获取所有剩余的对话链接
                const remainingChats = document.querySelectorAll('.chat-link');
                
                if (remainingChats.length > 0) {
                    // 如果还有其他对话，切换到第一个
                    const firstChatId = remainingChats[0].getAttribute('data-chat-id');
                    loadHistoryChat(firstChatId);
                    showSystemMessage('已切换到其他对话', 'info');
                } else {
                    // 如果没有其他对话，创建一个新的
                    startNewChat();
                }
            }
            
            // 更新localStorage
            saveChatHistoryList();
            
            // 显示成功消息
            showSystemMessage('已删除对话', 'success');
        } catch (error) {
            console.error('删除对话时出错:', error);
            alert('删除对话失败，请刷新页面重试。');
        }
    }

    // 更新会话标题
    function updateChatTitle(title) {
        // 查找当前活动的会话链接
        const activeChat = document.querySelector('.chat-link.active');
        if (activeChat) {
            // 保存原始内容以防包含删除按钮
            const deleteBtn = activeChat.querySelector('.delete-chat-btn');
            
            // 更新文本内容
            activeChat.textContent = title;
            
            // 如果有删除按钮，重新添加
            if (deleteBtn) {
                activeChat.appendChild(deleteBtn);
            }
            
            // 保存更新后的历史记录
            saveChatHistoryList();
        }
    }

    // 全局点击事件处理
    function handleGlobalClick(event) {
        const target = event.target;

        // 处理新对话按钮点击
        if (target.closest('#new-chat-button')) {
            startNewChat();
        }

        // 处理历史对话点击
        if (target.closest('.list-unstyled a')) {
            const chatLink = target.closest('.list-unstyled a');
            // 确保使用data-chat-id属性获取聊天ID
            const chatId = chatLink.dataset.chatId || chatLink.getAttribute('data-chat-id');
            if (chatId) {
                loadHistoryChat(chatId);
            }
        }

        // 处理侧边栏切换
        if (target.closest('.sidebar-toggle') || target.closest('.sidebar-backdrop')) {
            toggleSidebar();
        }
    }

    // 使用事件委托处理所有点击事件
    document.addEventListener('click', handleGlobalClick);
    
    // 初始化
    initializeChat();

    // 初始化聊天功能
	async function initializeChat() {
		// 初始禁用输入框和发送按钮
		setInputState(false);
        elements.sendButton.disabled = true; // 确保页面加载时发送按钮是禁用的
		showSystemMessage('正在加载必要组件...', 'info');

		try {
			// 检测是否为移动设备
			const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
			if (isMobile) {
				console.log('检测到移动设备');
				initMobileDebug();
			}
			
			// 加载外部资源
			await loadExternalResources();

        // 自动聚焦输入框
        focusInput();

        // 设置输入框事件监听
        elements.messageInput.addEventListener('input', handleInput);
        
        // 添加键盘事件监听，处理回车发送消息
        elements.messageInput.addEventListener('keydown', handleKeyPress);

        // 设置表单提交事件
        elements.chatForm.addEventListener('submit', handleSubmit);

        // 设置消息观察器
        setupMessageObserver();
        
        // 监听历史状态变化
        window.addEventListener('popstate', handleHistoryChange);

        // 初始化 Socket.IO
        initializeSocketIO();

        // 调试元素初始化状态
        console.log('初始化前检查上传菜单相关元素:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);
        
        // 重新获取元素（确保在DOM完全加载后）
        elements.addButton = document.getElementById('add-button');
        elements.uploadMenu = document.getElementById('upload-menu');
        elements.uploadFileOption = document.getElementById('upload-file-option');
        elements.fileUpload = document.getElementById('file-upload');
        
        console.log('重新获取后的元素:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);

        // 设置上传菜单事件
        setupUploadMenu();
        
        // 设置作业上传事件监听
        const uploadHomeworkOption = document.querySelector('.upload-option[data-type="homework"]');
        if (uploadHomeworkOption) {
            console.log('找到作业上传选项元素');
            const homeworkInput = document.createElement('input');
            homeworkInput.type = 'file';
            homeworkInput.multiple = true;
            homeworkInput.accept = 'image/*';
            homeworkInput.style.display = 'none';
            document.body.appendChild(homeworkInput);
            
            uploadHomeworkOption.addEventListener('click', () => {
                console.log('作业上传选项被点击');
                hideUploadMenu();
                homeworkInput.click();
            });
            
            homeworkInput.addEventListener('change', (e) => {
                console.log('选择了作业文件:', e.target.files);
                handleHomeworkUpload(e.target.files);
                homeworkInput.value = ''; // 清空选择，允许重复选择相同文件
            });
        } else {
            console.warn('未找到作业上传选项元素');
        }

			// 所有初始化完成后启用输入框，但保持发送按钮禁用状态（直到有输入）
			setInputState(true);
            elements.sendButton.disabled = true; // 初始状态下输入框是空的，所以发送按钮应该是禁用的
			showSystemMessage('准备就绪', 'success');
		} catch (error) {
			console.error('初始化失败:', error);
			showSystemMessage('初始化失败，请刷新页面重试', 'error');
		}
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
        
        // 更新发送按钮状态 - 确保消息为空时发送按钮处于禁用状态
        const isEmpty = !input.value.trim();
        elements.sendButton.disabled = isEmpty;
    }

    // 处理键盘事件
    function handleKeyPress(event) {
        // 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // 如果是移动设备，按下Enter键时插入换行
        if (isMobile) {
            if (event.key === 'Enter') {
                // 阻止默认行为（提交表单和自动插入换行）
            event.preventDefault();
                
                // 在移动设备上，默认Enter键插入换行
                insertNewline(event.target);
                return;
            }
            return; // 其他按键正常处理
        }
        
        // 桌面端处理：按下Enter键且没有按下Shift键和Alt键，则发送消息
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
            event.preventDefault(); // 阻止默认行为
            
            // 检查消息是否为空
            const isEmpty = !event.target.value.trim();
            if (!isEmpty) {
                handleSubmit(event); // 如果消息不为空，则发送
            } else {
                // 如果消息为空，可以添加振动反馈（如果支持）
                if (navigator.vibrate) {
                    navigator.vibrate(100); // 轻微振动提示
                }
            }
        }
        // 如果按下Enter键且按下Shift键或Alt键，则插入换行
        else if (event.key === 'Enter' && (event.shiftKey || event.altKey)) {
            event.preventDefault();
            insertNewline(event.target);
        }
    }
    
    // 插入换行的辅助函数
    function insertNewline(input) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            const value = input.value;
            const beforeCursor = value.substring(0, start);
            const afterCursor = value.substring(end);
            
        // 插入单个换行符，而不是两个
        input.value = beforeCursor + '\n' + afterCursor;
            
            // 将光标移动到新的位置
        input.selectionStart = input.selectionEnd = start + 1;
            
            // 触发input事件以调整文本框高度
            input.dispatchEvent(new Event('input'));
    }

    // 处理消息的显示
	function updateMessageDisplay(messageElement, content) {
		try {
			// 检查marked是否可用
			if (typeof window.marked === 'undefined') {
				console.warn('marked库未加载，使用基本渲染');
				// 基本渲染：保留HTML标签和数学公式
				const basicRenderedContent = content
					.replace(/\n/g, '<br>')  // 换行转换为<br>
					.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // 粗体
					.replace(/\*(.*?)\*/g, '<em>$1</em>')  // 斜体
					.replace(/`([^`]+)`/g, '<code>$1</code>')  // 行内代码
					.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')  // 代码块
					.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')  // 链接
					.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')  // 无序列表
					.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')  // 有序列表
					.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')  // 包装列表
					.replace(/^\s*>\s*(.+)$/gm, '<blockquote>$1</blockquote>')  // 引用
					.replace(/^\s*#{1,6}\s+(.+)$/gm, (match, text) => {
						const level = match.match(/^#+/)[0].length;
						return `<h${level}>${text}</h${level}>`;
					});  // 标题

				updateMessageContent(messageElement, basicRenderedContent);
			} else {
				// 使用marked渲染Markdown，但保护数学公式
				const mathExpressions = [];
				let mathIndex = 0;

				// 临时替换数学公式
				const contentWithPlaceholders = content.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
					mathExpressions.push(match);
					return `%%MATH_EXPR_${mathIndex++}%%`;
				});

				// 渲染Markdown
				let htmlContent = window.marked.parse(contentWithPlaceholders);

				// 恢复数学公式
				htmlContent = htmlContent.replace(/%%MATH_EXPR_(\d+)%%/g, (_, index) => mathExpressions[index]);

				updateMessageContent(messageElement, htmlContent);

				// 触发MathJax重新渲染
				if (window.MathJax && window.MathJax.typesetPromise) {
					window.MathJax.typesetPromise([messageElement]).catch((err) => {
						console.error('MathJax渲染错误:', err);
                    });
                }
            }
            
            // 滚动到底部
            scrollToBottom();
        } catch (error) {
            console.error('更新消息显示时出错:', error);
			// 发生错误时使用纯文本显示
			updateMessageContent(messageElement, escapeHtml(content));
		}
	}

	function preprocessTableContent(content) {
		const lines = content.split('\n');
		const result = [];
		let isInTable = false;
		let tableLines = [];

		for (let line of lines) {
			if (line.includes('|')) {
				if (!isInTable) {
					isInTable = true;
				}
				tableLines.push(line);
			} else {
				if (isInTable) {
					if (tableLines.length >= 2) {
						// 处理表格
						result.push('');  // 空行
						result.push(...formatTableLines(tableLines));
						result.push('');  // 空行
					} else {
						// 不是有效的表格，作为普通文本处理
						result.push(...tableLines);
					}
					isInTable = false;
					tableLines = [];
				}
				result.push(line);
			}
		}

		// 处理最后的表格（如果有）
		if (isInTable && tableLines.length >= 2) {
			result.push('');
			result.push(...formatTableLines(tableLines));
			result.push('');
		}

		return result.join('\n');
	}

	function formatTableLines(lines) {
		// 确保至少有标题行
		if (lines.length === 0) return [];

		// 处理每一行，标准化格式
		const formattedLines = lines.map(line => {
			// 移除首尾的|，并分割单元格
			const cells = line.trim().replace(/^\||\|$/g, '').split('|');

			// 处理每个单元格
			const formattedCells = cells.map(cell => cell.trim() || '-');

			// 重新组合行
			return `| ${formattedCells.join(' | ')} |`;
		});

		// 如果没有分隔行，在第一行后添加
		if (lines.length === 1 || !lines[1].includes('-')) {
			const headerCells = formattedLines[0].split('|').length - 2;
			const separator = `|${' --- |'.repeat(headerCells)}`;
			formattedLines.splice(1, 0, separator);
		}

		return formattedLines;
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

    // 添加表格缓冲处理
	let tableBuffer = '';
	let isCollectingTable = false;
	let tableStartIndex = -1;
    
    // 发送消息并获取流式响应（POST方式）
	async function askQuestionStreamPost(question, retryCount = 3) {
        try {
            // 参数验证
            if (!question || typeof question !== 'string') {
                throw new Error('无效的问题格式');
            }

            // 只在第一次尝试时显示用户消息，避免重复显示
            if (retryCount === 3) {
            addMessage(question, 'user');
            }
            
            // 禁用输入，表示正在处理
            setInputState(false);
            showSystemMessage(retryCount === 3 ? '正在思考...' : `正在重试(${3-retryCount}/3)...`, retryCount === 3 ? 'info' : 'warning');
            
            // 发送请求
            const response = await fetch('/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    question: question,
                    sessionId: sessionId || ''  // 确保sessionId不为undefined
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
                const {value, done} = await reader.read();
                
                if (done) {
                    console.log('流读取完成');
                    break;
                }

                // 解码新的数据块
                const chunk = decoder.decode(value, {stream: true});
                if (!chunk) continue;  // 跳过空块
                
                buffer += chunk;

                try {
                    // 按行分割并处理每一行
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (!line || !line.trim()) continue;  // 跳过空行

                        // 处理data行
                        if (line.startsWith('data:')) {
                            const data = line.slice(5).trim();
                    
                    // 如果是[DONE]标记，结束处理
                            if (data === '[DONE]') {
                        console.log('收到[DONE]标记，处理完成');
                        continue;
                    }
                    
                            // 尝试解析JSON数据
                            try {
                                const jsonData = JSON.parse(data);
                                
                                // 创建消息容器（如果还没有）
                            if (!messageContainer) {
                                    messageContainer = createMessageElement('assistant', '');
                                    if (elements.chatMessages) {
                                        elements.chatMessages.appendChild(messageContainer);
                                    }
                                }

                                // 更新消息内容
                                if (jsonData && jsonData.content !== undefined) {
                                    currentMessage += jsonData.content;
                                    if (messageContainer) {
                                        updateMessageDisplay(messageContainer, currentMessage);
                                    }
                                }
                            } catch (jsonError) {
                                console.warn('JSON解析失败:', jsonError);
                    }
                }
            }
        } catch (error) {
                    console.error('处理消息时出错:', error);
                }
            }

            setInputState(true);
            showSystemMessage('处理完成', 'success');

        } catch (error) {
            console.error('请求出错:', error);
            showSystemMessage(error.message, 'error');

            if (retryCount > 0) {
                console.log(`还剩 ${retryCount} 次重试机会`);
                // 等待一段时间再重试，时间随重试次数增加
                const delay = (3 - retryCount + 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                return askQuestionStreamPost(question, retryCount - 1);
            }

            setInputState(true);
            showSystemMessage('重试次数已用完，请重新发送消息', 'error');
        }
    }

    // 处理表单提交
    async function handleSubmit(event) {
        event.preventDefault();
        const question = elements.messageInput.value.trim();
        
        // 检查消息是否为空
        if (!question) {
            // 消息为空，不提交
            console.log('消息为空，不提交');
            // 针对移动设备，添加振动反馈（如果支持）
            if (navigator.vibrate) {
                navigator.vibrate(100); // 轻微振动100毫秒
            }
            return; // 直接返回，不执行后续代码
        }
        
            // 立即清空并重置输入框
            elements.messageInput.value = '';
            elements.messageInput.style.height = 'auto';
            elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 200)}px`;
            
            // 禁用输入和发送按钮
            setInputState(false);
            
            try {
            // 如果这是第一条消息，用它来设置对话标题
            const isFirstMessage = elements.chatMessages.children.length === 0;
            
            // 发送消息
                await askQuestionStreamPost(question);
            
            // 如果是第一条消息，将其作为对话标题
            if (isFirstMessage) {
                // 使用前20个字符作为标题，如果超过20字符则添加省略号
                const title = question.length > 20 ? question.substring(0, 20) + '...' : question;
                updateChatTitle(title);
            }
            } catch (error) {
                console.error('发送消息时出错:', error);
                showSystemMessage('发送消息失败，请重试', 'error');
                setInputState(true);
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

    // 设置输入状态
    function setInputState(enabled) {
        elements.messageInput.disabled = !enabled;
        // 根据输入框状态和内容设置发送按钮状态
        if (enabled) {
            // 只有当输入框有内容时才启用发送按钮
            const isEmpty = !elements.messageInput.value.trim();
            elements.sendButton.disabled = isEmpty;
        } else {
            // 禁用状态时，发送按钮也禁用
            elements.sendButton.disabled = true;
        }
        
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

				// 处理表格数据
				if (chunk.includes('|')) {
					if (!isCollectingTable) {
						// 开始收集表格数据
						isCollectingTable = true;
						tableStartIndex = responseText.length;
						tableBuffer = '';
					}
					tableBuffer += chunk;

					// 检查表格是否完整
					if (isTableComplete(tableBuffer)) {
						// 表格数据收集完成，进行渲染
						const processedTable = processTableData(tableBuffer);
						responseText = responseText.substring(0, tableStartIndex) + processedTable;
						isCollectingTable = false;
						tableBuffer = '';
					}
				} else {
					// 非表格数据直接添加
					if (isCollectingTable) {
						tableBuffer += chunk;
					} else {
                responseText += chunk;
					}
				}

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
		div.innerHTML = `            <div class="message-sender">${sender}</div>
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

			// 处理数学公式
			const mathExpressions = [];
			let mathIndex = 0;

			// 临时替换数学公式
			const contentWithPlaceholders = content.replace(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, (match) => {
				mathExpressions.push(match);
				return `%%MATH_EXPR_${mathIndex++}%%`;
			});

			// 转义HTML特殊字符，但保留数学公式占位符
			let processedContent = contentWithPlaceholders
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");

			// 恢复数学公式
			const finalContent = processedContent.replace(/%%MATH_EXPR_(\d+)%%/g, (_, index) => mathExpressions[index]);

			contentDiv.innerHTML = finalContent;

			// 触发MathJax渲染
			if (window.MathJax && window.MathJax.typesetPromise) {
				window.MathJax.typesetPromise([contentDiv]).catch((err) => {
					console.error('MathJax渲染错误:', err);
				});
			}
		} else {
			// AI消息：使用Markdown渲染
            // 检测是否为移动设备
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                // 添加一个空的div来确保移动端显示完整
                const spacerDiv = document.createElement('div');
                spacerDiv.style.height = '100px';  // 设置足够的高度
                spacerDiv.style.width = '100%';
                spacerDiv.style.clear = 'both';
                messageDiv.appendChild(spacerDiv);
            }
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

    // 处理历史状态变化
    function handleHistoryChange(event) {
        if (event.state && event.state.sessionId) {
            console.log('历史状态变化，新会话ID:', event.state.sessionId);
            // 更新当前会话ID
            sessionId = event.state.sessionId;
            
            // 检查此会话是否已在侧边栏中
            const existingChat = document.querySelector(`.chat-link[data-chat-id="${sessionId}"]`);
            if (!existingChat) {
                // 如果不存在，添加到侧边栏
                addChatToHistory('恢复的对话', sessionId);
            } else {
                // 高亮显示当前对话在侧边栏中的项
                updateActiveChat(sessionId);
            }
            
            // 清空消息显示区域，准备加载新会话
            elements.chatMessages.innerHTML = '';
            
            // 这里可以添加加载新会话消息的逻辑
            showSystemMessage('已切换到另一个对话', 'info');
        }
    }

    // 更新活动对话项
    function updateActiveChat(chatId) {
        // 移除所有活动状态
        document.querySelectorAll('.chat-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // 设置新的活动项
        const activeChat = document.querySelector(`.chat-link[data-chat-id="${chatId}"]`);
        if (activeChat) {
            activeChat.classList.add('active');
        }
    }

    // 开始新对话
    function startNewChat() {
        // 添加确认提示，防止意外清空对话
        if (elements.chatMessages.children.length > 0) {
            const confirmNewChat = window.confirm('开始新对话将清空当前对话内容，确定继续吗？');
            if (!confirmNewChat) {
                return; // 用户取消，不清空对话
            }
        }
        
        // 生成新的会话ID
        const newSessionId = generateSessionId();
        
        // 先在侧边栏添加新对话
        addChatToHistory('新对话', newSessionId);
        
        // 更新当前会话ID
        sessionId = newSessionId;
        
        // 清空消息显示区域
        elements.chatMessages.innerHTML = '';
        
        // 更新URL而不刷新页面
        const newUrl = `/chat/s/${newSessionId}`;
        window.history.pushState({ sessionId: newSessionId }, '', newUrl);
        
        // 显示欢迎消息
        showSystemMessage('已创建新对话', 'success');
        setTimeout(() => {
            focusInput(); // 聚焦到输入框
        }, 100);
    }

    // 加载历史对话
    function loadHistoryChat(chatId) {
        // 如果点击的是当前活动对话，不做任何操作
        if (chatId === sessionId) {
            return;
        }
        
        // 添加确认提示，防止意外丢失当前对话
        if (elements.chatMessages.children.length > 0) {
            const confirmLoad = window.confirm('切换到其他对话将离开当前对话，确定继续吗？');
            if (!confirmLoad) {
                return; // 用户取消，不切换对话
            }
        }
        
        // 更新当前会话ID
        sessionId = chatId;
        
        // 高亮显示当前对话
        updateActiveChat(chatId);
        
        // 清空消息显示区域，准备加载新会话
        elements.chatMessages.innerHTML = '';
        
        // 更新URL而不刷新页面
        const newUrl = `/chat/s/${chatId}`;
        window.history.pushState({ sessionId: chatId }, '', newUrl);
        
        // 这里可以添加加载新会话消息的逻辑
        showSystemMessage('已切换对话', 'info');
    }

    // 初始化 Socket.IO 连接
    function initializeSocketIO() {
        // 检查 Socket.IO 是否加载
        if (typeof io === 'undefined') {
            console.error('Socket.IO 未能加载，将尝试继续使用其他方式通信');
            showSystemMessage('Socket.IO 未能正确加载，但您仍然可以使用基本功能', 'warning');
            return;
        }

        try {
            // 获取当前主机和协议
            const protocol = window.location.protocol;
        const currentHost = window.location.hostname;
            const socketPort = '8081';
            const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
            
            console.log(`尝试连接Socket.IO服务器: ${currentHost}:${socketPort}, 协议: ${wsProtocol}`);
            
            const socket = io(`${protocol}//${currentHost}:${socketPort}`, {
                transports: ['websocket'],
                upgrade: false,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 20000,
                forceNew: true,
                path: '/socket.io/',
                withCredentials: true,
                secure: protocol === 'https:',
                rejectUnauthorized: false,
                extraHeaders: {
                    'Origin': window.location.origin
                }
            });

            // 添加连接事件监听
            socket.on('connect_error', (error) => {
                console.error('连接错误:', error);
                if (error.message.includes('xhr poll error')) {
                    socket.io.opts.transports = ['websocket'];
                }
                showSystemMessage(`无法连接到实时通讯服务器: ${error.message}`, 'warning');
            });

            socket.io.on('error', (error) => {
                console.error('传输错误:', error);
                showSystemMessage(`网络连接不稳定: ${error.message}`, 'warning');
            });

            socket.io.on('reconnect_attempt', (attempt) => {
                console.log(`第 ${attempt} 次重连尝试`);
                showSystemMessage(`正在尝试重新连接(${attempt}/5)...`, 'warning');
            });

            socket.io.on('reconnect_failed', () => {
                console.error('重连失败');
                showSystemMessage('无法连接到服务器，但您仍然可以使用基本功能', 'warning');
            });

            socket.on('connect', () => {
                console.log('Connected to Socket.IO server');
                showSystemMessage('已连接到实时通讯服务器', 'success');
                setInputState(true);
            });

            socket.on('disconnect', (reason) => {
                console.log('Disconnected:', reason);
                showSystemMessage(`连接断开: ${reason}`, 'warning');
            });

            socket.on('reconnect', (attemptNumber) => {
                console.log('Reconnected after', attemptNumber, 'attempts');
                showSystemMessage('重新连接成功', 'success');
            });

            window.chatSocket = socket;
            return socket;

        } catch (error) {
            console.error('初始化Socket.IO时出错:', error);
            showSystemMessage(`实时通讯初始化失败: ${error.message}`, 'warning');
            return null;
        }
    }

	// 初始化marked渲染器
	function initializeMarkedRenderer() {
		return new Promise((resolve, reject) => {
			// 确保marked已加载
			if (typeof window.marked === 'undefined') {
				console.warn('等待marked库加载...');
				setTimeout(() => initializeMarkedRenderer().then(resolve).catch(reject), 100);
				return;
			}

			try {
				// 配置marked选项
				const renderer = new window.marked.Renderer();

				// 自定义代码块渲染
				renderer.code = function(code, language) {
					const validLanguage = !!(language && hljs.getLanguage(language));
					const highlighted = validLanguage ? hljs.highlight(code, { language }).value : code;
					return `<pre><code class="hljs ${language || ''}">${highlighted}</code></pre>`;
				};

				// 自定义表格渲染
				renderer.table = function(header, body) {
					return '<div class="table-container">\n' +
						'<table>\n' +
						(header ? '<thead>\n' + header + '</thead>\n' : '') +
						(body ? '<tbody>\n' + body + '</tbody>\n' : '') +
						'</table>\n' +
						'</div>\n';
				};

				renderer.tablerow = function(content) {
					return '<tr>\n' + content + '</tr>\n';
				};

				renderer.tablecell = function(content, flags) {
					const type = flags.header ? 'th' : 'td';
					const align = flags.align ? ` style="text-align: ${flags.align}"` : '';
					return `<${type}${align}>${content || '-'}</${type}>\n`;
				};

				// 配置marked选项
				window.marked.setOptions({
					renderer: renderer,
					gfm: true,
					tables: true,
					breaks: true,
					pedantic: false,
					sanitize: false,
					smartLists: true,
					smartypants: false,
					highlight: function(code, language) {
						if (language && hljs.getLanguage(language)) {
							try {
								return hljs.highlight(code, { language }).value;
							} catch (err) {
								console.error('代码高亮出错:', err);
							}
						}
						return code;
					}
				});

				console.log('marked渲染器初始化完成');
				resolve();
			} catch (error) {
				console.error('初始化marked渲染器时出错:', error);
				reject(error);
			}
		});
    }

    // 加载外部资源的函数
    async function loadExternalResources() {
        const resources = [
            {
                type: 'script',
				primary: '/chat/js/marked.min.js',
				fallback: 'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
				id: 'marked-js',
				onload: async () => {
					console.log('marked库加载完成');
					try {
						await initializeMarkedRenderer();
					} catch (error) {
						console.error('初始化marked渲染器失败:', error);
						throw error;
					}
				}
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
			},
			{
				type: 'script',
				primary: '/vendor/mathjax/es5/tex-chtml.js',
				fallback: 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js',
				id: 'mathjax-js',
				async: true
            }
        ];

        try {
			showSystemMessage('正在加载资源...', 'info');

			// 首先配置MathJax
			window.MathJax = {
				tex: {
					inlineMath: [['$', '$'], ['\\(', '\\)']],
					displayMath: [['$$', '$$'], ['\\[', '\\]']],
					packages: { '[+]': ['ams', 'noerrors'] }
				},
				options: {
					skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
				}
			};

			// 然后加载资源
            for (const resource of resources) {
                await loadResource(resource);
            }

			console.log('所有资源加载完成');
			showSystemMessage('资源加载完成', 'success');
        } catch (error) {
            console.error('加载外部资源失败:', error);
            showSystemMessage('部分功能可能不可用', 'warning');
			throw error;
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

			element.onload = () => {
				if (resource.onload) {
					resource.onload();
				}
				resolve();
			};

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

    // 生成会话ID
    function generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 清除对话历史
    async function clearHistory() {
        // 添加确认提示，防止意外清空对话
        if (elements.chatMessages.children.length > 0) {
            const confirmClear = window.confirm('确定要清除所有对话历史吗？');
            if (!confirmClear) {
                return; // 用户取消，不清空对话
            }
        }
        
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

    // 设置上传菜单相关功能
    function setupUploadMenu() {
        // 检查元素是否存在
        console.log('开始初始化上传菜单');
        
        // 重新获取元素（确保在DOM完全加载后）
        elements.addButton = document.getElementById('add-button');
        elements.uploadMenu = document.getElementById('upload-menu');
        elements.uploadFileOption = document.getElementById('upload-file-option');
        elements.fileUpload = document.getElementById('file-upload');
        
        console.log('上传菜单元素状态:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);
        
        if (!elements.addButton || !elements.uploadMenu) {
            console.error('上传菜单元素不存在，跳过初始化');
            return;
        }
        
        // 设置初始状态
        elements.uploadMenu.style.display = 'none';
        elements.uploadMenu.classList.remove('show');
        
        // 点击加号按钮显示/隐藏菜单
        elements.addButton.addEventListener('click', function(e) {
            console.log('加号按钮被点击');
            e.preventDefault();
            e.stopPropagation(); // 阻止事件冒泡
            toggleUploadMenu();
        });
        
        // 点击上传文件选项
        if (elements.uploadFileOption) {
            elements.uploadFileOption.addEventListener('click', function(e) {
                console.log('上传文件选项被点击');
                e.preventDefault();
                e.stopPropagation(); // 阻止事件冒泡
                if (elements.fileUpload) {
                    elements.fileUpload.click();
                }
                hideUploadMenu();
            });
        }
        
        // 处理文件上传
        if (elements.fileUpload) {
            elements.fileUpload.addEventListener('change', handleFileUpload);
        }
        
        // 点击其他区域关闭菜单
        document.addEventListener('click', function(e) {
            if (elements.uploadMenu && 
                elements.uploadMenu.style.display !== 'none' &&
                !elements.uploadMenu.contains(e.target) && 
                e.target !== elements.addButton && 
                !elements.addButton.contains(e.target)) {
                hideUploadMenu();
            }
        });
        
        console.log('上传菜单初始化完成');
    }

    // 切换上传菜单显示/隐藏
    function toggleUploadMenu() {
        console.log('切换上传菜单状态');
        if (!elements.uploadMenu) {
            console.error('上传菜单元素不存在，无法切换');
            return;
        }
        
        // 使用display属性判断菜单是否可见
        const isMenuVisible = elements.uploadMenu.style.display !== 'none';
        console.log('当前菜单是否可见:', isMenuVisible);
        
        if (isMenuVisible) {
            hideUploadMenu();
        } else {
            showUploadMenu();
        }
    }

    // 显示上传菜单
    function showUploadMenu() {
        console.log('显示上传菜单');
        if (!elements.uploadMenu) {
            console.error('上传菜单元素不存在，无法显示');
            return;
        }
        
        // 先设置display样式，再添加show类（确保过渡效果正常）
        elements.uploadMenu.style.display = 'block';
        
        // 使用requestAnimationFrame确保样式变化被应用
        requestAnimationFrame(() => {
            elements.uploadMenu.classList.add('show');
            console.log('上传菜单已显示，classList:', elements.uploadMenu.classList);
        });
    }

    // 隐藏上传菜单
    function hideUploadMenu() {
        console.log('隐藏上传菜单');
        if (!elements.uploadMenu) {
            console.error('上传菜单元素不存在，无法隐藏');
            return;
        }
        
        // 先移除show类
        elements.uploadMenu.classList.remove('show');
        console.log('移除show类后的classList:', elements.uploadMenu.classList);
        
        // 直接设置不可见，不再使用延时
        elements.uploadMenu.style.display = 'none';
        console.log('设置菜单为不可见');
    }

    // 处理文件上传
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        console.log('准备上传文件:', file.name, '文件大小:', file.size, 'bytes');
        
        // 显示上传进度提示
        showSystemMessage(`正在上传文件: ${file.name}`, 'info');
        
        // 创建FormData对象
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);
        
        console.log('使用会话ID:', sessionId);
        
        // 发送文件到服务器
        fetch('/chat/upload', {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
        })
        .then(response => {
            console.log('上传响应状态:', response.status);
            if (!response.ok) {
                // 根据不同的错误状态码提供更友好的错误信息
                if (response.status === 406) {
                    throw new Error('不支持的文件格式，请上传允许的文件类型');
                } else if (response.status === 413) {
                    throw new Error('文件太大，请选择小于10MB的文件');
                } else if (response.status === 415) {
                    throw new Error('不支持的文件类型');
                } else {
                    throw new Error('上传失败，请稍后重试');
                }
            }
            return response.json();
        })
        .then(data => {
            // 上传成功
            console.log('上传成功，服务器响应:', data);
            showSystemMessage('文件上传成功', 'success');
            
            // 在聊天区域显示上传的文件
            addMessage(`上传了文件: ${file.name}`, 'user');
            
            // 如果有文件URL，添加到聊天消息中
            if (data && data.fileUrl) {
                console.log('文件URL:', data.fileUrl);
                const fileMessage = createFileMessage(file.name, data.fileUrl);
                elements.chatMessages.appendChild(fileMessage);
                scrollToBottom();
            }
            
            // 重置文件输入框
            event.target.value = '';
        })
        .catch(error => {
            console.error('文件上传错误:', error);
            showSystemMessage(error.message || '文件上传失败，请重试', 'error');
            // 重置文件输入框
            event.target.value = '';
        });
    }

    // 创建文件消息元素
    function createFileMessage(fileName, fileUrl) {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'message assistant';
        
        const senderDiv = document.createElement('div');
        senderDiv.className = 'message-sender';
        senderDiv.textContent = 'DeepSeek';
        fileDiv.appendChild(senderDiv);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // 根据文件类型显示不同的图标和处理方式
        const extension = fileName.split('.').pop().toLowerCase();
        let fileIcon = '📄'; // 默认文件图标
        let contentHtml = '';
        
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
            fileIcon = '🖼️';
            contentHtml = `
                <div class="file-attachment">
                    <div class="file-preview">
                        <img src="${fileUrl}" alt="${fileName}" style="max-width: 200px; max-height: 200px;">
                    </div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <a href="${fileUrl}" target="_blank" class="file-download">查看原图</a>
                    </div>
                </div>
            `;
        } else if (['pdf'].includes(extension)) {
            fileIcon = '📑';
            contentHtml = `
                <div class="file-attachment">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <a href="${fileUrl}" target="_blank" class="file-download">查看PDF</a>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `
                <div class="file-attachment">
                    <div class="file-icon">${fileIcon}</div>
                    <div class="file-info">
                        <div class="file-name">${fileName}</div>
                        <a href="${fileUrl}" target="_blank" class="file-download">下载文件</a>
                    </div>
                </div>
            `;
        }
        
        contentDiv.innerHTML = contentHtml;
        fileDiv.appendChild(contentDiv);
        return fileDiv;
    }

    // 添加会话状态跟踪
    const SessionStatus = {
        INITIALIZING: 'INITIALIZING',
        PROCESSING: 'PROCESSING',
        COMPLETED: 'COMPLETED',
        ERROR: 'ERROR'
    };

    let currentSessionStatus = SessionStatus.INITIALIZING;
    let lastError = null;

    function updateSessionStatus(status, error = null) {
        currentSessionStatus = status;
        lastError = error;
        
        // 更新UI状态
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status.toLowerCase()}`;
            statusIndicator.textContent = getStatusText(status);
        }
        
        // 如果有错误，显示错误信息
        if (error) {
            showErrorMessage(error);
        }
    }

    function getStatusText(status) {
        switch (status) {
            case SessionStatus.INITIALIZING:
                return '初始化中...';
            case SessionStatus.PROCESSING:
                return '处理中...';
            case SessionStatus.COMPLETED:
                return '已完成';
            case SessionStatus.ERROR:
                return '出错了';
            default:
                return '未知状态';
        }
    }

    function showErrorMessage(error) {
        const errorContainer = document.querySelector('.error-container');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="error-message">
                    <h4>${error.errorType || '错误'}</h4>
                    <p>${error.errorDescription || error.message || '发生未知错误'}</p>
                    ${error.stackTrace ? `<pre class="error-stack">${error.stackTrace}</pre>` : ''}
                </div>
            `;
            errorContainer.style.display = 'block';
        }
    }

    // 处理作业上传
    async function handleHomeworkUpload(files) {
        try {
            // 添加防御性检查
            if (!files || typeof files !== 'object') {
                console.error('文件对象无效:', files);
                showSystemMessage('文件上传失败：无效的文件对象', 'error');
                return;
            }

            updateSessionStatus(SessionStatus.INITIALIZING);
            
            console.log('开始处理作业上传，文件列表:', files);
            
            // 使用Array.from之前进行类型检查
            const filesList = files.length !== undefined ? Array.from(files) : [];
            console.log('转换后的文件列表:', filesList);
            
            if (filesList.length === 0) {
                showSystemMessage('请选择作业文件', 'error');
                return;
            }
            
            if (filesList.length > 5) {
                showSystemMessage('一次最多只能上传5张图片', 'error');
                return;
            }

            // 检查每个文件对象的有效性
            for (let file of filesList) {
                if (!file || typeof file !== 'object') {
                    console.error('无效的文件对象:', file);
                    showSystemMessage('文件上传失败：文件格式错误', 'error');
                    return;
                }

                console.log('检查文件:', file.name, '类型:', file.type, '大小:', file.size);
                
                if (!file.type || !file.type.startsWith('image/')) {
                    showSystemMessage('只能上传图片文件', 'error');
                    return;
                }
                
                if (!file.size || file.size > 10 * 1024 * 1024) { // 10MB
                    showSystemMessage('图片大小不能超过10MB', 'error');
                    return;
                }
            }
            
            console.log('文件验证通过，显示科目选择对话框');
            
            // 显示科目选择对话框
            const subjectDialog = document.createElement('div');
            subjectDialog.className = 'subject-dialog';
            subjectDialog.innerHTML = `
                <div class="subject-dialog-content">
                    <h3>请选择作业科目</h3>
                    <div class="subject-options">
                        <button data-subject="chinese">语文</button>
                        <button data-subject="math">数学</button>
                        <button data-subject="english">英语</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(subjectDialog);
            
            // 处理科目选择
            subjectDialog.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', async () => {
                    try {
                        const subject = button.dataset.subject;
                        console.log('选择科目:', subject, '文件数量:', filesList.length);
                        document.body.removeChild(subjectDialog);
                        await uploadHomework(filesList, subject);
        } catch (error) {
                        console.error('处理科目选择时出错:', error);
                        showSystemMessage(`处理失败: ${error.message}`, 'error');
                    }
                });
            });
        } catch (error) {
            console.error('处理作业上传时出错:', error);
            updateSessionStatus(SessionStatus.ERROR, {
                message: error.message,
                errorType: 'UPLOAD_ERROR',
                errorDescription: '上传作业时发生错误'
            });
            showSystemMessage('文件上传失败：' + error.message, 'error');
        }
    }

    // 上传作业并获取批改结果
    async function uploadHomework(files, subject) {
        try {
            console.log('开始上传作业 - 文件数量:', files.length, '科目:', subject);
            
            if (!files || !Array.isArray(files) || files.length === 0) {
                throw new Error('请选择要批改的作业文件');
            }
            
            if (!subject || subject.trim() === '') {
                throw new Error('请选择作业科目');
            }
            
            showSystemMessage('正在上传作业...', 'info');
            
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', file);
                console.log('添加文件到表单:', file.name, file.size, 'bytes');
            });
            formData.append('subject', subject);
            formData.append('sessionId', sessionId);
            
            console.log('准备发送请求 - 科目:', subject, '会话ID:', sessionId);
            
            // 创建消息容器
            const messageContainer = createMessageElement('assistant', '');
            elements.chatMessages.appendChild(messageContainer);
            messageContainer.querySelector('.message-content').innerHTML = '<div class="typing-indicator">正在批改作业...</div>';
            
            // 发送请求，添加完整的请求头
            const response = await fetch('/homework/check', {
                method: 'POST',
                headers: {
                    'Accept': 'text/event-stream, application/json, */*',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('服务器响应错误:', response.status, errorText);
                
                // 根据不同的错误状态码提供更友好的错误信息
                if (response.status === 406) {
                    throw new Error('服务器无法处理上传的文件格式，请确保上传的是图片文件');
                } else if (response.status === 413) {
                    throw new Error('文件太大，请压缩后再上传');
                } else if (response.status === 415) {
                    throw new Error('不支持的文件类型，请上传图片文件');
                } else {
                    throw new Error(`上传失败: ${errorText}`);
                }
            }
            
            // 检查响应类型
            const contentType = response.headers.get('content-type');
            if (!contentType || (!contentType.includes('text/event-stream') && !contentType.includes('application/json'))) {
                throw new Error('服务器返回了不支持的响应格式');
            }
            
            console.log('开始处理服务器响应');
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let lastContent = ''; // 用于保存最后的内容
            
            while (true) {
                const {value, done} = await reader.read();
                if (done) {
                    console.log('响应流读取完成');
                    break;
                }
                
                buffer += decoder.decode(value, {stream: true});
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.trim() === '') continue;
                    
                    if (line.startsWith('data:')) {
                        try {
                            const eventData = JSON.parse(line.slice(5));
                            
                            if (eventData.error) {
                                updateSessionStatus(SessionStatus.ERROR, eventData);
                                break;
                            }
                            
                            if (eventData.type === 'done') {
                                console.log('收到完成消息');
                                // 不做任何清空操作，保持最后的内容
                                continue;
                            }
                            
                            // 更新内容
                            if (eventData.content) {
                                lastContent = eventData.content; // 保存最新的内容
                                messageContainer.querySelector('.message-content').innerHTML = marked.parse(eventData.content);
                                
                                // 渲染数学公式
                                if (typeof renderMathInElement === 'function') {
                                    renderMathInElement(messageContainer.querySelector('.message-content'), {
                                        delimiters: [
                                            {left: '$$', right: '$$', display: true},
                                            {left: '$', right: '$', display: false},
                                            {left: '\\(', right: '\\)', display: false},
                                            {left: '\\[', right: '\\]', display: true}
                                        ],
                                        throwOnError: false
                                    });
                                }
                            }
                        } catch (e) {
                            console.error('解析消息时出错:', e);
                        }
                    }
                }
            }
            
            // 确保显示最后的内容
            if (lastContent) {
                messageContainer.querySelector('.message-content').innerHTML = marked.parse(lastContent);
                // 最后一次渲染数学公式
                if (typeof renderMathInElement === 'function') {
                    renderMathInElement(messageContainer.querySelector('.message-content'), {
                        delimiters: [
                            {left: '$$', right: '$$', display: true},
                            {left: '$', right: '$', display: false},
                            {left: '\\(', right: '\\)', display: false},
                            {left: '\\[', right: '\\]', display: true}
                        ],
                        throwOnError: false
                    });
                }
            }
            
            // 滚动到底部
            scrollToBottom();
            
            updateSessionStatus(SessionStatus.COMPLETED);
        } catch (error) {
            console.error('作业批改失败:', error);
            updateSessionStatus(SessionStatus.ERROR, {
                message: error.message,
                errorType: 'UPLOAD_ERROR',
                errorDescription: '上传作业时发生错误'
            });
            showSystemMessage(error.message, 'error');
        }
    }

    // 添加移动端调试支持
    function initMobileDebug() {
        // 只保留基本的错误捕获功能
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            console.error('错误: ' + msg + '\n' +
                         '文件: ' + url + '\n' +
                         '行号: ' + lineNo + '\n' +
                         '列号: ' + columnNo + '\n' +
                         '错误对象: ' + JSON.stringify(error));
            return false;
        };
        
        // 添加Promise错误捕获
        window.onunhandledrejection = function(event) {
            console.error('Promise错误: ', event.reason);
        };
        
        // 添加基本的移动端信息日志
        console.log('移动端设备信息:', {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenSize: `${window.screen.width}x${window.screen.height}`,
            devicePixelRatio: window.devicePixelRatio,
            orientation: window.orientation
        });
    }

    // 在初始化函数中调用
    async function initializeChat() {
        try {
            // 检测是否为移动设备
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                console.log('检测到移动设备');
                initMobileDebug();
            }
            
            // 加载外部资源
            await loadExternalResources();

        // 自动聚焦输入框
        focusInput();

        // 设置输入框事件监听
        elements.messageInput.addEventListener('input', handleInput);
        
        // 添加键盘事件监听，处理回车发送消息
        elements.messageInput.addEventListener('keydown', handleKeyPress);

        // 设置表单提交事件
        elements.chatForm.addEventListener('submit', handleSubmit);

        // 设置消息观察器
        setupMessageObserver();
        
        // 监听历史状态变化
        window.addEventListener('popstate', handleHistoryChange);

        // 初始化 Socket.IO
        initializeSocketIO();

        // 调试元素初始化状态
        console.log('初始化前检查上传菜单相关元素:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);
        
        // 重新获取元素（确保在DOM完全加载后）
        elements.addButton = document.getElementById('add-button');
        elements.uploadMenu = document.getElementById('upload-menu');
        elements.uploadFileOption = document.getElementById('upload-file-option');
        elements.fileUpload = document.getElementById('file-upload');
        
        console.log('重新获取后的元素:');
        console.log('- 加号按钮:', elements.addButton);
        console.log('- 上传菜单:', elements.uploadMenu);
        console.log('- 上传文件选项:', elements.uploadFileOption);
        console.log('- 文件上传输入:', elements.fileUpload);

        // 设置上传菜单事件
        setupUploadMenu();
        
        // 设置作业上传事件监听
        const uploadHomeworkOption = document.querySelector('.upload-option[data-type="homework"]');
        if (uploadHomeworkOption) {
            console.log('找到作业上传选项元素');
            const homeworkInput = document.createElement('input');
            homeworkInput.type = 'file';
            homeworkInput.multiple = true;
            homeworkInput.accept = 'image/*';
            homeworkInput.style.display = 'none';
            document.body.appendChild(homeworkInput);
            
            uploadHomeworkOption.addEventListener('click', () => {
                console.log('作业上传选项被点击');
                hideUploadMenu();
                homeworkInput.click();
            });
            
            homeworkInput.addEventListener('change', (e) => {
                console.log('选择了作业文件:', e.target.files);
                handleHomeworkUpload(e.target.files);
                homeworkInput.value = ''; // 清空选择，允许重复选择相同文件
            });
        } else {
            console.warn('未找到作业上传选项元素');
        }

			// 所有初始化完成后启用输入框，但保持发送按钮禁用状态（直到有输入）
			setInputState(true);
            elements.sendButton.disabled = true; // 初始状态下输入框是空的，所以发送按钮应该是禁用的
			showSystemMessage('准备就绪', 'success');
		} catch (error) {
			console.error('初始化失败:', error);
			showSystemMessage('初始化失败，请刷新页面重试', 'error');
		}
    }
});