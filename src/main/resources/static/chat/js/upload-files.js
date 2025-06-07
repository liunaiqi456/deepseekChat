// 这个文件包含文件上传功能的修复代码
// 请在页面加载完成后执行以下代码

document.addEventListener('DOMContentLoaded', () => {
    console.log('正在应用文件上传修复...');
    
    // 获取关键元素
    const uploadFileOption = document.getElementById('upload-file-option');
    const fileUpload = document.getElementById('file-upload');
    
    console.log('文件上传选项元素:', uploadFileOption);
    console.log('文件上传输入元素:', fileUpload);
    
    // 设置文件上传选项点击事件
    if (uploadFileOption) {
        console.log('设置文件上传选项点击事件监听器');
        uploadFileOption.addEventListener('click', () => {
            console.log('文件上传选项被点击');
            
            // 获取上传菜单元素（可能已经被重新定义）
            const uploadMenu = document.getElementById('upload-menu');
            
            // 隐藏上传菜单
            if (uploadMenu) {
                uploadMenu.classList.remove('show');
                uploadMenu.style.display = 'none';
                console.log('已隐藏上传菜单');
            }
            
            // 触发文件选择对话框
            // 重新获取文件上传输入元素，确保是最新的
            const currentFileUpload = document.getElementById('file-upload');
            if (currentFileUpload) {
                currentFileUpload.click();
                console.log('已触发文件选择对话框');
            } else {
                console.error('文件上传输入框不存在');
            }
        });
    } else {
        console.warn('未找到文件上传选项元素');
    }
    
    // 设置文件上传输入框change事件
    if (fileUpload) {
        console.log('设置文件上传输入框change事件监听器');
        
        // 直接在原始元素上添加监听器，不替换元素
        fileUpload.addEventListener('change', (event) => {
            console.log('文件上传输入框change事件触发');
            const file = event.target.files[0];
            if (!file) {
                console.log('未选择文件');
                return;
            }
            
            console.log('选择的文件:', file.name, file.type, file.size);
            
            // 构造表单数据
            const formData = new FormData();
            formData.append('file', file);
            
            // 获取会话ID
            // 优先从 URL 中获取 sessionId 参数
            let sessionId = null;
            
            // 从 URL 中获取 sessionId
            const urlParams = new URLSearchParams(window.location.search);
            sessionId = urlParams.get('sessionId');
            console.log('从 URL 获取的会话ID:', sessionId);
            
            // 如果 URL 中没有，尝试从其他来源获取
            if (!sessionId) {
                // 尝试从路径中提取
                const pathParts = window.location.pathname.split('/');
                for (let i = 0; i < pathParts.length; i++) {
                    if (pathParts[i] && pathParts[i].length > 8) {
                        sessionId = pathParts[i];
                        console.log('从路径获取的会话ID:', sessionId);
                        break;
                    }
                }
            }
            
            // 如果还是没有，尝试从 DOM 属性获取
            if (!sessionId) {
                sessionId = document.body.getAttribute('data-session-id');
                if (sessionId) {
                    console.log('从 body 属性获取的会话ID:', sessionId);
                }
            }
            
            // 如果还是没有，尝试从 localStorage 获取
            if (!sessionId) {
                sessionId = localStorage.getItem('sessionId');
                if (sessionId) {
                    console.log('从 localStorage 获取的会话ID:', sessionId);
                }
            }
            
            console.log('使用的会话ID:', sessionId);
            formData.append('sessionId', sessionId);
            
            // 发送文件上传请求
            fetch('/chat/upload', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                },
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    console.error('服务器响应错误:', response.status, response.statusText);
                    throw new Error(`服务器响应错误: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('文件上传成功:', data);
                if (data && data.fileUrl) {
                    // 获取消息容器
                    const chatMessages = document.getElementById('chat-messages');
                    if (chatMessages) {
                        // 创建文件消息元素
                        const fileMessage = document.createElement('div');
                        fileMessage.className = 'message user-message';
                        // 从服务器返回的URL中提取文件名
                        let displayFileName = file.name;
                        
                        // 尝试从服务器返回的URL中提取文件名
                        if (data.fileUrl) {
                            const urlParts = data.fileUrl.split('/');
                            const serverFileName = urlParts[urlParts.length - 1];
                            if (serverFileName && serverFileName.length > 0) {
                                // 如果服务器文件名是UUID，则使用原始文件名但去除重复扩展名
                                if (serverFileName.includes('-') && serverFileName.length > 30) {
                                    // 使用原始文件名，但去除可能的重复扩展名
                                    const dotIndex = displayFileName.indexOf('.');
                                    if (dotIndex !== -1) {
                                        const nameWithoutExt = displayFileName.substring(0, dotIndex);
                                        const ext = displayFileName.substring(dotIndex);
                                        // 检查是否有重复扩展名
                                        if (nameWithoutExt.toLowerCase().endsWith('.png') || 
                                            nameWithoutExt.toLowerCase().endsWith('.jpg') || 
                                            nameWithoutExt.toLowerCase().endsWith('.jpeg')) {
                                            displayFileName = nameWithoutExt + ext.toLowerCase();
                                        }
                                    }
                                } else {
                                    // 如果服务器文件名不是UUID，直接使用
                                    displayFileName = serverFileName;
                                }
                            }
                        }
                        
                        console.log('显示的文件名:', displayFileName);
                        
                        fileMessage.innerHTML = `
                            <div class="message-content">
                                <div class="file-message">
                                    <a href="${data.fileUrl}" target="_blank" class="file-link">
                                        <span class="file-icon">📎</span>
                                        <span class="file-name">${displayFileName}</span>
                                    </a>
                                </div>
                            </div>
                        `;
                        
                        // 添加到聊天区域
                        chatMessages.appendChild(fileMessage);
                        
                        // 滚动到底部
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                        console.log('已添加文件消息到聊天区域');
                    }
                }
                // 清空文件输入，以便重复上传相同文件
                event.target.value = '';
            })
            .catch(error => {
                console.error('文件上传失败:', error);
                // 显示错误消息
                const systemMessages = document.getElementById('system-messages');
                if (systemMessages) {
                    const errorMsg = document.createElement('div');
                    errorMsg.className = 'system-message error';
                    errorMsg.textContent = '文件上传失败，请重试';
                    systemMessages.appendChild(errorMsg);
                    
                    // 3秒后自动移除错误消息
                    setTimeout(() => {
                        errorMsg.remove();
                    }, 3000);
                }
                // 清空文件输入，以便重试
                event.target.value = '';
            });
        });
    } else {
        console.warn('未找到文件上传输入框元素');
    }
    
    console.log('文件上传修复已应用');
});
