import { utils } from './utils.js';

export class MessageRenderer {
    constructor() {
        this.initializeMarkedRenderer();
    }

    // 初始化Marked渲染器
    initializeMarkedRenderer() {
        if (typeof window.marked !== 'undefined') {
            const renderer = new window.marked.Renderer();
            
            // 保持表格渲染
            renderer.table = (header, body) => {
                return `<table class="table table-bordered">\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n`;
            };
            
            // 保持代码块渲染
            renderer.code = (code, language) => {
                const validLanguage = language || 'plaintext';
                return `<pre><code class="language-${validLanguage}">${utils.escapeHtml(code)}</code></pre>`;
            };

            // 设置marked选项
            window.marked.setOptions({
                renderer: renderer,
                highlight: function(code, lang) {
                    if (typeof window.hljs !== 'undefined') {
                        const language = window.hljs.getLanguage(lang) ? lang : 'plaintext';
                        return window.hljs.highlight(code, { language }).value;
                    }
                    return code;
                },
                langPrefix: 'hljs language-',
                pedantic: false,
                gfm: true,
                breaks: true,
                sanitize: false,
                smartypants: false,
                xhtml: false
            });
        }
    }

    // 更新消息显示
    updateMessageDisplay(messageElement, content) {
        try {
            if (typeof window.marked === 'undefined') {
                console.warn('marked库未加载，使用基本渲染');
                const basicRenderedContent = this.basicRender(content);
                this.updateMessageContent(messageElement, basicRenderedContent);
                return;
            }

            // 保护数学公式
            const mathExpressions = [];
            let mathIndex = 0;

            // 临时替换数学公式
            const contentWithPlaceholders = content.replace(
                /(\$\$[\s\S]*?\$\$|\$[^\$\n]+\$|\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g,
                (match) => {
                    mathExpressions.push(match);
                    return `%%MATH_EXPR_${mathIndex++}%%`;
                }
            );

            // 渲染Markdown
            let htmlContent = window.marked.parse(contentWithPlaceholders);

            // 还原数学公式
            htmlContent = htmlContent.replace(/%%MATH_EXPR_(\d+)%%/g, (_, index) => {
                return mathExpressions[index];
            });

            // 更新消息内容
            this.updateMessageContent(messageElement, htmlContent);

            // 处理数学公式渲染
            if (typeof window.MathJax !== 'undefined') {
                window.MathJax.typesetPromise([messageElement]);
            }
        } catch (error) {
            console.error('渲染消息时出错:', error);
            this.updateMessageContent(messageElement, content, true);
        }
    }

    // 基本渲染（当marked不可用时）
    basicRender(content) {
        return content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
            .replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
            .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/^\s*>\s*(.+)$/gm, '<blockquote>$1</blockquote>')
            .replace(/^\s*#{1,6}\s+(.+)$/gm, (match, text) => {
                const level = match.match(/^#+/)[0].length;
                return `<h${level}>${text}</h${level}>`;
            });
    }

    // 更新消息内容
    updateMessageContent(messageDiv, content, isError = false) {
        const messageContent = messageDiv.querySelector('.message-content') || messageDiv;
        messageContent.innerHTML = isError ? `<div class="error-message">${content}</div>` : content;
    }

    // 创建消息元素
    createMessageElement(sender, content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'assistant-message'}`;
        messageDiv.innerHTML = `
            <div class="message-header">${sender}</div>
            <div class="message-content"></div>
        `;
        return messageDiv;
    }

    // 添加消息到聊天界面
    addMessage(content, type = 'assistant') {
        const chatMessages = document.getElementById('chat-messages');
        const isUser = type === 'user';
        const messageDiv = this.createMessageElement(isUser ? '用户' : 'AI助手', content, isUser);
        chatMessages.appendChild(messageDiv);
        this.updateMessageDisplay(messageDiv, content);
        utils.scrollToBottom();
        return messageDiv;
    }

    // 显示系统消息
    showSystemMessage(message, type = 'info') {
        const statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            statusBar.textContent = message;
            statusBar.className = `status-bar ${type}`;
        }
    }
} 