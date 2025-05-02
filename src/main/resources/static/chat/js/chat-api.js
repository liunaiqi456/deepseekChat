export class ChatAPI {
    constructor(messageRenderer) {
        this.messageRenderer = messageRenderer;
        this.socket = null;
        this.currentBuffer = '';
    }

    // 初始化Socket.IO连接
    initializeSocketIO() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('WebSocket连接已建立');
                this.messageRenderer.showSystemMessage('WebSocket连接已建立', 'success');
            });

            this.socket.on('disconnect', () => {
                console.log('WebSocket连接已断开');
                this.messageRenderer.showSystemMessage('WebSocket连接已断开', 'error');
            });

            this.socket.on('error', (error) => {
                console.error('WebSocket错误:', error);
                this.messageRenderer.showSystemMessage('WebSocket错误: ' + error, 'error');
            });

            this.socket.on('chat message', (msg) => {
                console.log('收到消息:', msg);
                this.messageRenderer.addMessage(msg, 'assistant');
            });

        } catch (error) {
            console.error('初始化Socket.IO时出错:', error);
            this.messageRenderer.showSystemMessage('初始化Socket.IO失败', 'error');
        }
    }

    // 发送问题到服务器
    async askQuestionStreamPost(question, retryCount = 3) {
        try {
            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: question })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let currentMessageElement = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                this.currentBuffer += chunk;

                // 处理完整的SSE消息
                const messages = this.currentBuffer.split('\n\n');
                this.currentBuffer = messages.pop() || '';

                for (const message of messages) {
                    if (!message.trim()) continue;

                    const lines = message.split('\n');
                    const dataLines = lines
                        .filter(line => line.startsWith('data: '))
                        .map(line => line.slice(6));

                    if (dataLines.length === 0) continue;

                    try {
                        for (const dataLine of dataLines) {
                            if (dataLine === '[DONE]') continue;
                            const parsed = JSON.parse(dataLine);
                            
                            if (!currentMessageElement) {
                                currentMessageElement = this.messageRenderer.addMessage('', 'assistant');
                            }
                            
                            if (parsed.content) {
                                this.messageRenderer.updateMessageDisplay(currentMessageElement, parsed.content);
                            }
                        }
                    } catch (e) {
                        console.error('解析消息时出错:', e);
                        continue;
                    }
                }
            }

            return true;
        } catch (error) {
            console.error('发送问题时出错:', error);
            if (retryCount > 0) {
                console.log(`重试 (${retryCount} 次剩余)...`);
                return this.askQuestionStreamPost(question, retryCount - 1);
            }
            this.messageRenderer.showSystemMessage('发送消息失败', 'error');
            return false;
        }
    }

    // 清除历史记录
    async clearHistory() {
        try {
            const response = await fetch('/api/chat/clear', {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('清除历史记录结果:', result);
            return true;
        } catch (error) {
            console.error('清除历史记录时出错:', error);
            return false;
        }
    }
} 