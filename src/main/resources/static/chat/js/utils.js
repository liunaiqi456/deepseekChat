// 通用工具函数
export const utils = {
    // 生成会话ID
    generateSessionId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // 转义HTML
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    // 解码HTML实体
    decodeHtmlEntities(text) {
        const textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        return textArea.value;
    },

    // 检查是否为代码
    looksLikeCode(text) {
        const codeIndicators = [
            /^```[\s\S]*```$/m,  // 代码块
            /`[^`]+`/,           // 行内代码
            /{[\s\S]*}/,         // 花括号
            /\([^)]*\)/,         // 圆括号
            /function\s*\(/,      // 函数声明
            /=>/,                // 箭头函数
            /const|let|var/,     // 变量声明
            /if|for|while|do/,   // 控制结构
            /\[[\s\S]*\]/,       // 数组
            /import|export/,      // 模块语法
            /class\s+\w+/        // 类声明
        ];
        return codeIndicators.some(pattern => pattern.test(text));
    },

    // 检查用户是否正在选择文本
    isUserSelecting() {
        const selection = window.getSelection();
        return selection && selection.toString().length > 0;
    },

    // 平滑滚动到底部
    scrollToBottom(smooth = true) {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const scrollOptions = {
                top: chatMessages.scrollHeight,
                behavior: smooth ? 'smooth' : 'auto'
            };
            chatMessages.scrollTo(scrollOptions);
        }
    },

    // 调整文本框高度
    adjustTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    },

    // 插入换行
    insertNewline(input) {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const value = input.value;
        const beforeCursor = value.substring(0, start);
        const afterCursor = value.substring(end);
        
        input.value = beforeCursor + '\n' + afterCursor;
        input.selectionStart = input.selectionEnd = start + 1;
        input.dispatchEvent(new Event('input'));
    }
}; 