import { utils } from './utils.js';
import { MessageRenderer } from './message-renderer.js';
import { ChatAPI } from './chat-api.js';

class ChatApp {
    constructor() {
        this.elements = {
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            chatMessages: document.getElementById('chat-messages'),
            chatForm: document.getElementById('chat-form'),
            sidebar: document.querySelector('.sidebar'),
            sidebarToggle: document.querySelector('.sidebar-toggle'),
            sidebarBackdrop: document.querySelector('.sidebar-backdrop'),
            statusBar: document.querySelector('.status-bar')
        };

        this.messageRenderer = new MessageRenderer();
        this.chatAPI = new ChatAPI(this.messageRenderer);
        
        this.initialize();
    }

    async initialize() {
        // 初始禁用输入框和发送按钮
        this.setInputState(false);
        this.elements.sendButton.disabled = true;
        this.messageRenderer.showSystemMessage('正在加载必要组件...', 'info');

        try {
            // 加载外部资源
            await this.loadExternalResources();
            
            // 设置事件监听器
            this.setupEventListeners();
            
            // 初始化Socket.IO
            this.chatAPI.initializeSocketIO();

            // 启用输入框，但保持发送按钮禁用状态
            this.setInputState(true);
            this.elements.sendButton.disabled = true;
            this.messageRenderer.showSystemMessage('准备就绪', 'success');
            
            // 自动聚焦输入框
            this.focusInput();
        } catch (error) {
            console.error('初始化失败:', error);
            this.messageRenderer.showSystemMessage('初始化失败，请刷新页面重试', 'error');
        }
    }

    setupEventListeners() {
        // 全局点击事件
        document.addEventListener('click', this.handleGlobalClick.bind(this));
        
        // 输入框事件
        this.elements.messageInput.addEventListener('input', this.handleInput.bind(this));
        this.elements.messageInput.addEventListener('keydown', this.handleKeyPress.bind(this));
        
        // 表单提交事件
        this.elements.chatForm.addEventListener('submit', this.handleSubmit.bind(this));
    }

    handleGlobalClick(event) {
        const target = event.target;

        if (target.closest('.new-chat-btn')) {
            this.startNewChat();
        }

        if (target.closest('.list-unstyled a')) {
            this.loadHistoryChat(target.closest('a').dataset.chatId);
        }

        if (target.closest('.sidebar-toggle') || target.closest('.sidebar-backdrop')) {
            this.toggleSidebar();
        }
    }

    handleInput(event) {
        const input = event.target;
        utils.adjustTextareaHeight(input);
        this.elements.sendButton.disabled = !input.value.trim();
    }

    handleKeyPress(event) {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (event.type === 'keydown') {
                    utils.insertNewline(event.target);
                }
                return;
            }
            return;
        }
        
        if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            const isEmpty = !event.target.value.trim();
            if (!isEmpty) {
                this.handleSubmit(event);
            } else if (navigator.vibrate) {
                navigator.vibrate(100);
            }
        } else if (event.key === 'Enter' && (event.altKey || event.shiftKey)) {
            event.preventDefault();
            utils.insertNewline(event.target);
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        const messageInput = this.elements.messageInput;
        const message = messageInput.value.trim();
        
        if (!message) return;
        
        // 禁用输入和发送按钮
        this.setInputState(false);
        
        // 显示用户消息
        this.messageRenderer.addMessage(message, 'user');
        
        // 清空输入框并重置高度
        messageInput.value = '';
        utils.adjustTextareaHeight(messageInput);
        
        try {
            // 发送消息到服务器
            await this.chatAPI.askQuestionStreamPost(message);
        } finally {
            // 重新启用输入
            this.setInputState(true);
            this.elements.sendButton.disabled = true;
            this.focusInput();
        }
    }

    setInputState(enabled) {
        this.elements.messageInput.disabled = !enabled;
        this.elements.sendButton.disabled = !enabled;
        
        if (!enabled) {
            this.elements.messageInput.style.cursor = 'not-allowed';
            this.elements.sendButton.style.cursor = 'not-allowed';
        } else {
            this.elements.messageInput.style.cursor = 'text';
            this.elements.sendButton.style.cursor = 'pointer';
        }
    }

    focusInput() {
        if (!this.elements.messageInput.disabled && !utils.isUserSelecting()) {
            this.elements.messageInput.focus();
        }
    }

    toggleSidebar() {
        document.body.classList.toggle('sidebar-open');
    }

    async startNewChat() {
        if (await this.chatAPI.clearHistory()) {
            this.elements.chatMessages.innerHTML = '';
            this.messageRenderer.showSystemMessage('新对话已开始', 'success');
        }
    }

    loadHistoryChat(chatId) {
        console.log('加载历史对话:', chatId);
        // TODO: 实现历史对话加载功能
    }

    async loadExternalResources() {
        const resources = [
            { type: 'script', url: '/chat/js/marked.min.js' },
            { type: 'script', url: '/chat/js/highlight.min.js' },
            { type: 'script', url: '/vendor/mathjax/es5/tex-mml-chtml.js' },
        ];

        const loadPromises = resources.map(resource => this.loadResource(resource));
        await Promise.all(loadPromises);
    }

    loadResource(resource) {
        return new Promise((resolve, reject) => {
            let element;
            
            if (resource.type === 'script') {
                element = document.createElement('script');
                element.src = resource.url;
                element.async = true;
            } else if (resource.type === 'style') {
                element = document.createElement('link');
                element.rel = 'stylesheet';
                element.href = resource.url;
            }

            element.onload = () => resolve();
            element.onerror = () => reject(new Error(`Failed to load ${resource.url}`));
            
            document.head.appendChild(element);
        });
    }
}

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
}); 