document.addEventListener('DOMContentLoaded', () => {
    // 全局点击事件处理
    function handleGlobalClick(event) {
        const target = event.target;

        // 处理新对话按钮点击 - 需要确保这是实际的新对话按钮，而不是发送按钮
        if (target.closest('.new-chat-btn')) {  // 修改选择器为更具体的类名
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

    // 初始化聊天功能
	async function initializeChat() {
		// 初始禁用输入框和发送按钮
		setInputState(false);
        elements.sendButton.disabled = true; // 确保页面加载时发送按钮是禁用的
		showSystemMessage('正在加载必要组件...', 'info');

		try {
			// 加载外部资源
			await loadExternalResources();

        // 自动聚焦输入框
        focusInput();

        // 设置输入框事件监听
        elements.messageInput.addEventListener('input', handleInput);

        // 设置表单提交事件
        elements.chatForm.addEventListener('submit', handleSubmit);

        // 设置消息观察器
        setupMessageObserver();

        // 初始化 Socket.IO
        initializeSocketIO();

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
        
        // 如果是移动设备，处理换行
        if (isMobile) {
            // 在移动设备上，只处理Enter键事件一次
            if (event.key === 'Enter') {
                // 阻止默认行为（提交表单和自动插入换行）
                event.preventDefault();
                
                // 只在keydown事件时插入换行
                if (event.type === 'keydown') {
                    insertNewline(event.target);
                }
                return;
            }
            // 其他按键正常处理
            return;
        }
        
        // 桌面端处理：按下Enter键且没有按下Shift键和Alt键，则发送消息
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            // 检查消息是否为空
            const isEmpty = !event.target.value.trim();
            if (!isEmpty) {
            handleSubmit(event);
            } else {
                // 如果消息为空，可以添加提示或振动反馈
                if (navigator.vibrate) {
                    navigator.vibrate(100); // 轻微振动提示
                }
            }
        }
        // 如果按下Enter键且按下Alt键或Shift键，则插入换行
        else if (event.key === 'Enter' && (event.altKey || event.shiftKey)) {
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

    // 生成会话ID
    const sessionId = generateSessionId();

	// 添加表格缓冲处理
	let tableBuffer = '';
	let isCollectingTable = false;
	let tableStartIndex = -1;
    
    // 发送消息并获取流式响应（POST方式）
	async function askQuestionStreamPost(question, retryCount = 3) {
        try {
            // 显示用户的问题（添加到当前对话中，不清空已有内容）
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

				try {
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
                        continue;
                    }
                    
							// 尝试解析JSON数据
							try {
								const jsonData = JSON.parse(data);
								if (jsonData.content !== undefined) {  // 检查content是否存在
									// 创建消息容器（如果还没有）
                            if (!messageContainer) {
										messageContainer = createMessageElement('assistant', '');
										elements.chatMessages.appendChild(messageContainer);
									}
									// 提取实际内容
									const content = typeof jsonData.content === 'string'
										? jsonData.content
										: JSON.stringify(jsonData.content);

									currentMessage += content;
									// 使用原有的updateMessageDisplay函数来保持渲染功能
									updateMessageDisplay(messageContainer, currentMessage);
								}
							} catch (jsonError) {
								console.warn('JSON解析失败，尝试提取content字段');
								// 使用正则表达式提取content字段的值
								const contentMatch = data.match(/"content"\s*:\s*"([^"]*?)(?<!\\)"/);
								if (contentMatch && contentMatch[1]) {
									if (!messageContainer) {
										messageContainer = createMessageElement('assistant', '');
										elements.chatMessages.appendChild(messageContainer);
									}
									const content = contentMatch[1]
										.replace(/\\"/g, '"')
										.replace(/\\\\/g, '\\')
										.replace(/\\n/g, '\n')
										.replace(/\\r/g, '\r')
										.replace(/\\t/g, '\t');

									currentMessage += content;
									updateMessageDisplay(messageContainer, currentMessage);
								} else {
									// 如果无法提取content，尝试直接使用data
									if (!messageContainer) {
										messageContainer = createMessageElement('assistant', '');
										elements.chatMessages.appendChild(messageContainer);
									}
									currentMessage += data;
									updateMessageDisplay(messageContainer, currentMessage);
								}
							}
						} else if (line.includes('event:') || line.includes('id:')) {
							// 忽略事件和ID行
							continue;
						} else {
							// 处理其他行
							if (!messageContainer) {
								messageContainer = createMessageElement('assistant', '');
								elements.chatMessages.appendChild(messageContainer);
							}
							currentMessage += line + '\n';
							updateMessageDisplay(messageContainer, currentMessage);
                }
            }
        } catch (error) {
					console.error('处理消息时出错:', error);
					if (messageContainer) {
						updateMessageContent(messageContainer, '处理消息时发生错误，请重试。', true);
					}
				}
			}

            setInputState(true);
			showSystemMessage('处理完成', 'success');

		} catch (error) {
			console.error('请求出错:', error);
			showSystemMessage(error.message, 'error');

			if (retryCount > 0) {
				console.log(`还剩 ${retryCount} 次重试机会`);
				showSystemMessage('正在重试...', 'warning');
				// 注意：重试时也不应清空已有对话
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
            // 注意：这里不应该清空已有对话内容
                await askQuestionStreamPost(question);
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

    // 开始新对话
    function startNewChat() {
        // 添加确认提示，防止意外清空对话
        if (elements.chatMessages.children.length > 0) {
            const confirmNewChat = window.confirm('开始新对话将清空当前对话内容，确定继续吗？');
            if (!confirmNewChat) {
                return; // 用户取消，不清空对话
            }
        }
        
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
				transports: ['websocket'],           // 只使用WebSocket
				upgrade: false,                      // 禁用传输升级
				reconnectionAttempts: 5,             // 重连次数
				reconnectionDelay: 1000,             // 重连延迟
				timeout: 20000,                      // 超时时间
                forceNew: true,
				path: '/socket.io/',                 // 注意这里加了末尾的斜杠
				withCredentials: true                // 允许跨域认证
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
});

