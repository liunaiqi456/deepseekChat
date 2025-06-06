/**
 * 语音聊天页面JavaScript
 * 提供WebSocket连接、音频录制和处理功能
 */

// WebSocket连接
let isRecording = false;
let isCallActive = false;
let mediaStream = null;
let processor = null;
let analyser = null;
let audioContext = null;
let recognitionSocket = null;
let socket = null;
let callStartTime = null;
let callTimer = null;
let reconnectTimer = null;
let heartbeatInterval = null;
let sessionId = null; // 当前会话ID

/**
 * 生成UUID用于会话标识
 * @returns {string} UUID字符串
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 心跳相关变量
let heartbeatTimer = null;
let heartbeatTimeoutTimer = null;

// 音频轨道相关变量
let currentAudioTrack = null;
let currentStream = null;

// 静音检测相关变量
let lastAudioActivity = 0;
let silenceTimer = null;
let silenceThreshold = 0.01; // 音量阈值，低于此值视为静音
let silenceTimeout = 3000; // 静音超过3秒自动停止录音

// 音频数据相关变量
// 全局音频数据对象，用于安全地存储和访问音频数据
const audioDataManager = {
    data: new Float32Array(4096),  // 初始化为空数组
    update: function(newData) {
        try {
            if (newData && newData.length > 0) {
                // 如果大小不同，创建新数组
                if (this.data.length !== newData.length) {
                    this.data = new Float32Array(newData.length);
                }
                // 复制数据
                for (let i = 0; i < newData.length; i++) {
                    this.data[i] = newData[i];
                }
            }
        } catch (err) {
            console.error('更新音频数据时出错:', err);
        }
    },
    get: function() {
        try {
            return this.data;
        } catch (err) {
            console.error('获取音频数据时出错:', err);
            return new Float32Array(4096); // 返回空数组作为备用
        }
    },
    addNoise: function(inputData) {
        try {
            const result = new Float32Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                // 增加噪声强度到0.05，确保能被识别为有效音频
                result[i] = inputData[i] + (Math.random() * 0.1 - 0.05);
            }
            return result;
        } catch (err) {
            console.error('添加噪声时出错:', err);
            const result = new Float32Array(4096);
            for (let i = 0; i < result.length; i++) {
                // 同样增加备用噪声强度
                result[i] = (Math.random() * 0.1 - 0.05);
            }
            return result;
        }
    }
};

// 心跳相关变量
const HEARTBEAT_INTERVAL = 3000; // 3秒发送一次心跳

// 音频保活相关变量
const AUDIO_KEEPALIVE_INTERVAL = 3000; // 3秒检查一次音频发送状态
const AUDIO_SEND_MAX_INTERVAL = 3000; // 最大音频发送间隔，超过则发送保活包

// 重连相关变量
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectDelay = 2000; // 初始重连延迟2秒

// 计时器相关变量
let callDuration = 0;

// DOM元素 - 使用let而非const，允许在ensureUIElements中重新赋值
let statusText = document.getElementById('statusText');
let callTimerElement = document.getElementById('callTimer');
let subtitleArea = document.getElementById('subtitleArea');
let subtitleText = document.getElementById('subtitleText');
let micBtn = document.getElementById('micBtn');
let micStatus = document.getElementById('micStatus'); // 添加缺失的micStatus变量
let callBtn = document.getElementById('callBtn');
let callIcon = document.getElementById('callIcon');
let hangupIcon = document.getElementById('hangupIcon');
let subtitleToggle = document.getElementById('subtitleToggle');
let settingsPanel = document.getElementById('settingsPanel');
let closeSettings = document.getElementById('closeSettings');
let interruptToggle = document.getElementById('interruptToggle');
let naturalMode = document.getElementById('naturalMode');
let pushToTalkMode = document.getElementById('pushToTalkMode');
let connectionStatus = document.getElementById('connectionStatus');
// micStatus已在上面声明，这里不再重复声明

// 状态变量
let showSubtitles = false;
let currentMode = 'natural'; // 默认使用自然对话模式

// 会话状态管理
const sessionState = {
    id: null,               // 会话唯一 ID
    startTime: null,        // 会话开始时间
    lastActivityTime: null, // 最近一次活动时间
    recognitionResults: [], // 已收到的识别结果
    status: 'idle'          // idle | active | error | closed
};

function updateSessionState(newState) {
    Object.assign(sessionState, newState);
    if (!newState.lastActivityTime) {
        sessionState.lastActivityTime = Date.now();
    }
    console.log('[Session] 状态更新:', sessionState);
}

// 语音合成测试文本
const testSynthesisText = '你好，我是DeepseekChat的语音助手。很高兴与你交流。';

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化音频
    initAudio();
    
    // 事件监听器
    setupEventListeners();
    
    // 添加语音合成测试按钮
    addSynthesisTestButton();
});

/**
 * 初始化语音合成WebSocket
 */
function initSynthesisWebSocket() {
    const wsUrl = `ws://${window.location.host}/ws/voice/synthesis`;
    socket = new WebSocket(wsUrl);
    
    socket.onopen = function() {
        console.log("语音合成WebSocket连接已建立");
        isConnected = true;
        connectionStatus.textContent = "Connected";
        updateCallButtonState(true); // 更新通话按钮状态
        statusText.textContent = "Ready to talk...";
    };
    
    socket.onmessage = function(event) {
        try {
            // 检查是否是二进制数据
            if (event.data instanceof Blob) {
                // 处理音频数据
                playAudio(event.data);
                return;
            }
            
            const message = JSON.parse(event.data);
            if (message.type === 'text') {
                // 更新字幕
                if (showSubtitles) {
                    updateSubtitle(message.content);
                }
            } else if (message.type === 'error') {
                statusText.textContent = `Error: ${message.content}`;
            } else if (message.type === 'heartbeat_ack') {
                console.debug('收到心跳确认:', message.timestamp);
            } else if (message.type === 'complete') {
                console.log('语音合成完成');
            }
        } catch (e) {
            console.error("解析消息失败:", e);
        }
    };
    
    socket.onclose = function() {
        console.log("语音合成WebSocket连接已关闭");
        isConnected = false;
        connectionStatus.textContent = "Disconnected";
        updateCallButtonState(false);
        stopCallTimer();
        statusText.textContent = "Call ended";
    };
    
    socket.onerror = function(error) {
        console.error("WebSocket错误:", error);
        statusText.textContent = "Connection error";
    };
}

/**
 * 初始化语音识别WebSocket
 */
function initRecognitionWebSocket() {
    // 重置重连计数器
    reconnectAttempts = 0;
    
    // 清除可能存在的重连定时器
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    const wsUrl = `ws://${window.location.host}/ws/voice/recognition`;
    recognitionSocket = new WebSocket(wsUrl);
    
    recognitionSocket.onopen = function() {
        console.log("语音识别WebSocket连接已建立");
        micStatus.textContent = "Ready";
        statusText.textContent = "连接成功";
        
        // 重置重连变量
        reconnectAttempts = 0;
        reconnectDelay = 2000;
        
        // 生成新的会话ID
        sessionId = generateUUID();
        console.log("新会话ID生成:", sessionId);
        
        // 发送阿里云标准格式的初始配置
        const aliConfig = {
            header: {
                message_id: generateUUID(),
                task_id: sessionId,
                namespace: "SpeechRecognizer",
                name: "StartRecognition",
                appkey: "default" // 如果有实际的appkey应该替换
            },
            payload: {
                format: "pcm",
                sample_rate: 16000,
                enable_intermediate_result: true,
                enable_punctuation_prediction: true,
                enable_inverse_text_normalization: true
            }
        };
        
        // 发送阿里云标准格式的配置
        recognitionSocket.send(JSON.stringify(aliConfig));
        console.log("发送阿里云标准配置:", aliConfig);
        
        // 发送本地配置
        const localConfig = {
            type: "config",
            interrupt: interruptToggle.checked
        };
        recognitionSocket.send(JSON.stringify(localConfig));
        
        // 启动心跳
        startHeartbeat();
        
        // 初始化会话状态
        updateSessionState({
            id: sessionId,
            startTime: Date.now(),
            status: 'active'
        });
        
        // 更新通话按钮状态
        updateCallButtonState(true);
    };
    
    recognitionSocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            // 任何结果都视为会话活跃
            updateSessionState({ lastActivityTime: Date.now() });
            
            if (data.type === "result") {
                // 处理识别结果
                if (data.status === "partial") {
                    updateSubtitle(data.content);
                } else if (data.status === "final") {
                    clearSubtitle();
                    addMessage("我", data.content, "user");
                    // 保存最终结果到会话状态
                    sessionState.recognitionResults.push({
                        type: 'final',
                        text: data.content,
                        time: Date.now()
                    });
                }
            } else if (data.type === "error") {
                console.error("语音识别错误:", data.content);
                addMessage("错误", data.content, "error");
            } else if (data.type === "heartbeat_ack") {
                // 处理心跳响应
                console.log("收到心跳响应:", data.timestamp);
            } else if (data.type === "reconnect") {
                // 处理服务器端重连成功的消息
                console.log("服务器端重连成功:", data.content);
                statusText.textContent = "服务器重连成功";
                // 重置重连计数器
                reconnectAttempts = 0;
                reconnectDelay = 2000;
                setTimeout(() => {
                    statusText.textContent = "Ready to talk...";
                }, 2000);
            }
        } catch (e) {
            console.error("解析消息失败:", e);
        }
    };
    
    recognitionSocket.onclose = function(event) {
        console.log("语音识别WebSocket连接已关闭，代码:", event.code, "原因:", event.reason);
        // 关闭时首先清理资源
        cleanupResources();
        
        // 尝试重连
        if (isCallActive && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            attemptReconnect();
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            statusText.textContent = "重连失败，请重新拨打";
            connectionStatus.textContent = "Disconnected";
            updateCallButtonState(false);
        } else {
            // 正常关闭
            updateCallButtonState(false);
        }
    };
    
    recognitionSocket.onerror = function(error) {
        handleRecognitionError(error);
    };
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 确保麦克风按钮存在
    if (!micBtn || !document.body.contains(micBtn)) {
        console.log('麦克风按钮不存在，尝试重新获取');
        micBtn = document.getElementById('micButton');
        if (!micBtn) {
            console.warn('找不到麦克风按钮，尝试创建 UI 元素');
            ensureUIElements();
            micBtn = document.getElementById('micButton');
            if (!micBtn) {
                console.error('无法创建麦克风按钮，事件监听器设置失败');
                return;
            }
        }
    }
    
    // 确保状态文本存在
    if (!micStatus || !document.body.contains(micStatus)) {
        console.log('麦克风状态文本不存在，尝试重新获取');
        micStatus = document.getElementById('micStatus');
        if (!micStatus) {
            console.warn('找不到麦克风状态文本');
            ensureUIElements();
            micStatus = document.getElementById('micStatus');
        }
    }
    
    // 麦克风按钮 - 按住说话模式
    
    // 添加按下事件 - 开始录音
    micBtn.addEventListener('mousedown', function() {
        if (!isRecording) {
            console.log('检测到麦克风按钮按下事件');
            // 如果通话未激活，自动创建会话
            if (!isCallActive) {
                console.log('通话未激活，自动创建会话');
                // 自动创建会话
                startCall();
                // 等待会话建立
                setTimeout(() => {
                    startRecording();
                    if (micBtn) {
                        micBtn.classList.remove('bg-gray-200');
                        micBtn.classList.add('bg-green-500');
                    }
                    if (micStatus) micStatus.textContent = "正在录音...";
                    if (statusText) statusText.textContent = "请说话，我在听...";
                }, 500);
            } else {
                console.log('通话已激活，直接开始录音');
                // 如果通话已激活，直接开始录音
                startRecording();
                if (micBtn) {
                    micBtn.classList.remove('bg-gray-200');
                    micBtn.classList.add('bg-green-500');
                }
                if (micStatus) micStatus.textContent = "正在录音...";
                if (statusText) statusText.textContent = "请说话，我在听...";
            }
            
            // 添加按下效果
            if (micBtn) {
                micBtn.style.transform = "scale(0.95)";
                micBtn.style.boxShadow = "0 0 0 3px rgba(72, 187, 120, 0.5)";
            }
        }
    });
    
    // 添加松开事件 - 停止录音
    micBtn.addEventListener('mouseup', function() {
        if (isRecording) {
            console.log('检测到麦克风按钮松开事件，停止录音');
            stopRecording();
            if (micBtn) {
                micBtn.classList.remove('bg-green-500');
                micBtn.classList.add('bg-gray-200');
                // 移除按下效果
                micBtn.style.transform = "";
                micBtn.style.boxShadow = "";
            }
            if (micStatus) micStatus.textContent = "录音已停止";
            if (statusText) statusText.textContent = "录音已停止";
        }
    });
    
    // 添加鼠标离开事件 - 防止用户拖动鼠标离开按钮后仍然录音
    micBtn.addEventListener('mouseleave', function() {
        if (isRecording) {
            console.log('检测到鼠标离开麦克风按钮，停止录音');
            stopRecording();
            if (micBtn) {
                micBtn.classList.remove('bg-green-500');
                micBtn.classList.add('bg-gray-200');
                // 移除按下效果
                micBtn.style.transform = "";
                micBtn.style.boxShadow = "";
            }
            if (micStatus) micStatus.textContent = "录音已停止";
            if (statusText) statusText.textContent = "录音已停止";
        }
    });
    
    // 添加触摸事件支持 - 移动设备支持
    micBtn.addEventListener('touchstart', function(e) {
        e.preventDefault(); // 防止触发点击事件
        console.log('检测到触摸开始事件');
        if (!isRecording) {
            // 如果通话未激活，自动创建会话
            if (!isCallActive) {
                console.log('通话未激活，自动创建会话');
                // 自动创建会话
                startCall();
                // 等待会话建立
                setTimeout(() => {
                    startRecording();
                    if (micBtn) {
                        micBtn.classList.remove('bg-gray-200');
                        micBtn.classList.add('bg-green-500');
                    }
                    if (micStatus) micStatus.textContent = "正在录音...";
                    if (statusText) statusText.textContent = "请说话，我在听...";
                }, 500);
            } else {
                console.log('通话已激活，直接开始录音');
                // 如果通话已激活，直接开始录音
                startRecording();
                if (micBtn) {
                    micBtn.classList.remove('bg-gray-200');
                    micBtn.classList.add('bg-green-500');
                }
                if (micStatus) micStatus.textContent = "正在录音...";
                if (statusText) statusText.textContent = "请说话，我在听...";
            }
            
            // 添加按下效果
            if (micBtn) {
                micBtn.style.transform = "scale(0.95)";
                micBtn.style.boxShadow = "0 0 0 3px rgba(72, 187, 120, 0.5)";
            }
        }
    });
    
    // 添加触摸结束事件 - 停止录音
    micBtn.addEventListener('touchend', function(e) {
        e.preventDefault(); // 防止触发点击事件
        console.log('检测到触摸结束事件');
        if (isRecording) {
            stopRecording();
            if (micBtn) {
                micBtn.classList.remove('bg-green-500');
                micBtn.classList.add('bg-gray-200');
                // 移除按下效果
                micBtn.style.transform = "";
                micBtn.style.boxShadow = "";
            }
            if (micStatus) micStatus.textContent = "录音已停止";
            if (statusText) statusText.textContent = "录音已停止";
        }
    });
    
    // 添加触摸取消事件 - 停止录音
    micBtn.addEventListener('touchcancel', function(e) {
        e.preventDefault(); // 防止触发点击事件
        console.log('检测到触摸取消事件');
        if (isRecording) {
            stopRecording();
            if (micBtn) {
                micBtn.classList.remove('bg-green-500');
                micBtn.classList.add('bg-gray-200');
                // 移除按下效果
                micBtn.style.transform = "";
                micBtn.style.boxShadow = "";
            }
            if (micStatus) micStatus.textContent = "录音已停止";
            if (statusText) statusText.textContent = "录音已停止";
        }
    });
    
    // 添加点击事件 - 切换录音状态
    micBtn.addEventListener('click', function(e) {
        // 防止与触摸事件冲突
        if (e.pointerType === 'touch') {
            return;
        }
        
        console.log('检测到麦克风按钮点击事件');
        if (isRecording) {
            stopRecording();
            if (micBtn) {
                micBtn.classList.remove('bg-green-500');
                micBtn.classList.add('bg-gray-200');
            }
            if (micStatus) micStatus.textContent = "Off";
            if (statusText) statusText.textContent = "录音已停止";
        } else {
            // 如果通话未激活，自动创建会话
            if (!isCallActive) {
                startCall();
                setTimeout(() => {
                    startRecording();
                    if (micBtn) {
                        micBtn.classList.remove('bg-gray-200');
                        micBtn.classList.add('bg-green-500');
                    }
                    if (micStatus) micStatus.textContent = "On";
                    if (statusText) statusText.textContent = "请说话，我在听...";
                }, 500);
            } else {
                startRecording();
                if (micBtn) {
                    micBtn.classList.remove('bg-gray-200');
                    micBtn.classList.add('bg-green-500');
                }
                if (micStatus) micStatus.textContent = "On";
                if (statusText) statusText.textContent = "请说话，我在听...";
            }
        }
    });
    
    // 添加按钮提示
    micBtn.title = "按住说话";
    const micHint = document.createElement('div');
    micHint.className = "text-xs text-gray-500 mt-1";
    micBtn.parentNode.appendChild(micHint);
    
    // 通话按钮 - 同时处理连接和挂断功能
    callBtn.addEventListener('click', function() {
        if (isCallActive) {
            // 如果通话已激活，执行挂断操作
            endCall();
        } else {
            // 如果通话未激活，执行连接操作
            startCall();
        }
    });
    
    // 字幕切换
    subtitleToggle.addEventListener('click', function() {
        this.classList.toggle('bg-indigo-600');
        this.classList.toggle('text-white');
        
        // 切换字幕显示状态
        showSubtitles = !showSubtitles;
        
        // 显示或隐藏字幕区域
        if (showSubtitles) {
            subtitleArea.classList.remove('hidden');
        } else {
            subtitleArea.classList.add('hidden');
            clearSubtitle();
        }
    });
    
    // 关闭设置按钮
    if (closeSettings) {
        closeSettings.addEventListener('click', function() {
            settingsPanel.classList.add('hidden');
        });
    }
    
    // 智能打断切换
    if (interruptToggle) {
        interruptToggle.addEventListener('change', function() {
            if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                const config = {
                    type: "config",
                    interrupt: this.checked
                };
                recognitionSocket.send(JSON.stringify(config));
            }
        });
    }
    
    // 对话模式切换
    if (naturalMode && pushToTalkMode) {
        naturalMode.addEventListener('click', function() {
            if (currentMode !== 'natural') {
                currentMode = 'natural';
                naturalMode.classList.add('active');
                pushToTalkMode.classList.remove('active');
                
                // 如果正在录音，停止录音
                if (isRecording) {
                    stopRecording();
                    micBtn.classList.remove('bg-green-500');
                    micBtn.classList.add('bg-gray-200');
                    micStatus.textContent = "Off";
                }
            }
        });
        
        pushToTalkMode.addEventListener('click', function() {
            if (currentMode !== 'push-to-talk') {
                currentMode = 'push-to-talk';
                pushToTalkMode.classList.add('active');
                naturalMode.classList.remove('active');
                
                // 如果正在录音，停止录音
                if (isRecording) {
                    stopRecording();
                    micBtn.classList.remove('bg-green-500');
                    micBtn.classList.add('bg-gray-200');
                    micStatus.textContent = "Off";
                }
            }
        });
    }
}

/**
 * 添加消息到聊天区域
 */
function addMessage(sender, text, type) {
    // 检查messageContainer是否存在
    const container = document.getElementById('messageContainer');
    if (!container) {
        console.error('消息容器不存在');
        // 如果是错误消息，显示在状态区
        if (type === 'error' && statusText) {
            statusText.textContent = text;
            setTimeout(() => {
                statusText.textContent = 'Ready to talk...';
            }, 3000);
        }
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `p-3 rounded-lg mb-2 message-${type}`;
    messageDiv.innerHTML = `<p>${text}</p>`;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
    
    // 如果是系统消息或助手消息，使用语音合成读出来
    if ((sender === 'system' || sender === 'assistant') && type !== 'error' && isConnected) {
        // 调用语音合成API
        synthesizeSpeech(text);
    }
}

/**
 * 更新字幕
 */
function updateSubtitle(text) {
    // 只有当字幕开关打开时才显示字幕
    if (!showSubtitles) return;
    
    let subtitleElement = document.getElementById('subtitle');
    if (!subtitleElement) {
        subtitleElement = document.createElement('div');
        subtitleElement.id = 'subtitle';
        subtitleElement.className = 'fixed bottom-24 left-0 right-0 text-center bg-black bg-opacity-50 text-white p-2';
        document.body.appendChild(subtitleElement);
    }
    
    subtitleElement.textContent = text;
}

/**
 * 清除字幕
 */
function clearSubtitle() {
    const subtitleElement = document.getElementById('subtitle');
    if (subtitleElement) {
        subtitleElement.remove();
    }
}

/**
 * 播放音频
 */
function playAudio(audioData) {
    const audioBlob = audioData instanceof Blob ? audioData : new Blob([audioData], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    audio.onended = function() {
        URL.revokeObjectURL(audioUrl);
        
        // 如果是自然对话模式，播放结束后自动开始录音
        if (currentMode === 'natural' && !isRecording) {
            startRecording();
            micBtn.classList.remove('bg-gray-200');
            micBtn.classList.add('bg-green-500');
        }
    };
    
    audio.play().catch(error => {
        console.error("音频播放失败:", error);
        addMessage("错误", "音频播放失败", "error");
    });
}

/**
 * 初始化音频录制
 */
function initAudio() {
    try {
        // 确保AudioContext可用
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        
        // 尝试创建16kHz采样率的AudioContext
        // 注意：大多数浏览器会忽略这个设置，使用系统默认值（通常是44.1kHz或48kHz）
        audioContext = new AudioContext({
            sampleRate: 16000 // 尝试设置为16kHz
        });
        
        console.log("音频上下文已创建，采样率：", audioContext.sampleRate, "Hz");
        
        // 检查实际采样率
        if (audioContext.sampleRate !== 16000) {
            console.warn("警告：浏览器不支持16kHz采样率，实际采样率为", audioContext.sampleRate, "Hz");
            console.log("将在发送音频数据前进行采样率转换");
        }
    } catch (e) {
        console.error("Web Audio API不受支持:", e);
        addMessage("错误", "您的浏览器不支持Web Audio API", "error");
    }
}

/**
 * 开始录音
 */
function startRecording() {
    if (isRecording) return;
    
    console.log('开始录音');
    
    // 启动通话计时器
    startCallTimer();
    
    // 记录最后一次音频发送时间
    window.lastAudioSendTime = Date.now();
    
    // 添加音频保活定时器
    window.audioKeepAliveTimer = setInterval(() => {
        // 如果超过设定时间没有发送音频数据，发送一个静音音频包
        if (Date.now() - window.lastAudioSendTime > AUDIO_SEND_MAX_INTERVAL && recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
            console.log('发送音频保活包，距离上次发送已经过去:', (Date.now() - window.lastAudioSendTime), 'ms');
            
            // 创建一个短的静音音频包，但添加微弱信号避免被识别为完全静音
            const silentPacket = new Float32Array(1024);
            // 添加微弱的非零随机值，确保不会被识别为静音
            for (let i = 0; i < silentPacket.length; i += 5) { // 增加信号频率
                silentPacket[i] = 0.005 + (Math.random() * 0.01); // 增强信号强度
            }
            
            const processedData = convertFloat32ToInt16(silentPacket);
            
            // 发送静音包
            if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                try {
                    recognitionSocket.send(processedData.buffer);
                    console.log('音频保活包已发送，大小:', processedData.length, '字节');
                    
                    // 更新最后发送时间
                    window.lastAudioSendTime = Date.now();
                } catch (error) {
                    console.error('发送音频保活包失败:', error);
                }
            }
        }
    }, 1000);
    
    // 检查浏览器是否支持getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusText) statusText.textContent = '您的浏览器不支持麦克风访问';
        console.error('浏览器不支持getUserMedia API');
        addMessage('系统', '您的浏览器不支持麦克风访问，请尝试使用Chrome或Firefox浏览器', 'error');
        return;
    }
    
    // 检查是否在安全上下文中运行
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        if (statusText) statusText.textContent = '麦克风访问需要HTTPS连接';
        console.error('麦克风访问需要安全上下文');
        addMessage('系统', '麦克风访问需要HTTPS连接，除非在localhost上运行', 'error');
        return;
    }
    
    // 确保页面上有必要的UI元素
    ensureUIElements();
    
    console.log('正在请求麦克风权限...');
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(function(stream) {
            console.log('麦克风权限获取成功!');
            mediaStream = stream;
            
            // 检查麦克风轨道状态
            const audioTracks = stream.getAudioTracks();
            console.log('麦克风轨道数量:', audioTracks.length);
            audioTracks.forEach((track, index) => {
                console.log(`麦克风轨道 ${index}:`, {
                    标签: track.label,
                    启用状态: track.enabled,
                    静音状态: track.muted,
                    设置: track.getSettings()
                });
            });
            
            // 创建音频处理节点
            const source = audioContext.createMediaStreamSource(stream);
            
            // 创建分析器节点，用于音频可视化
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            
            // 初始化分析器节点和音频处理器
            // 我们使用全局audioDataManager对象安全地管理音频数据
            
            // 注意：ScriptProcessorNode已弃用，但由于兼容性原因暂时保留
            // 在未来版本中应迁移到AudioWorkletNode
            processor = audioContext.createScriptProcessor(4096, 1, 1);
            source.connect(processor);
            processor.connect(audioContext.destination);
            
            // 使用局部变量存储当前处理的音频数据
            // 然后通过audioDataManager安全地更新全局状态
            const bufferSize = analyser.fftSize;
            let currentAudioData = new Float32Array(bufferSize);
            
            // 添加音频处理事件，确保捕获原始音频数据
            processor.onaudioprocess = function(e) {
                try {
                    // 捕获输入缓冲区的数据
                    const inputBuffer = e.inputBuffer;
                    const inputData = inputBuffer.getChannelData(0);
                    
                    // 更新局部音频数据
                    if (!currentAudioData || currentAudioData.length !== inputData.length) {
                        currentAudioData = new Float32Array(inputData.length);
                    }
                    
                    // 添加一些噪声，确保不全为零
                    for (let i = 0; i < inputData.length; i++) {
                        // 如果原始数据非常小，添加更强的噪声
                        if (Math.abs(inputData[i]) < 0.01) {
                            currentAudioData[i] = inputData[i] + (Math.random() * 0.1 - 0.05);
                        } else {
                            currentAudioData[i] = inputData[i];
                        }
                    }
                    
                    // 安全地更新全局音频数据
                    audioDataManager.update(currentAudioData);
                    if (Math.random() < 0.1) { // 仅每10次输出一次日志
                        console.debug('已安全更新全局音频数据');
                    }
                
                    // 计算并输出音频统计信息（调试用）
                    let sum = 0;
                    let peak = 0;
                    for (let i = 0; i < currentAudioData.length; i++) {
                        sum += Math.abs(currentAudioData[i]);
                        peak = Math.max(peak, Math.abs(currentAudioData[i]));
                    }
                    const avg = sum / currentAudioData.length;
                    
                    // 每10次处理输出一次调试信息，避免控制台过载
                    if (Math.random() < 0.1) {
                        console.debug("原始音频数据统计: 平均=" + avg.toFixed(4) + ", 峰值=" + peak.toFixed(4));
                    }
                } catch (error) {
                    console.error("处理音频数据时出错:", error);
                }
            };
            
            // 定期采样音频数据并发送 - 按照阿里云SDK要求调整为100ms一次
            const sendInterval = setInterval(() => {
                if (!isRecording) {
                    clearInterval(sendInterval);
                    return;
                }
                
                // 直接从分析器获取当前音频数据
                // 确保缓冲区大小约为3200字节(16kHz采样率下约100ms的音频)
                const bufferLength = 3200; // 设置为固定大小，确保每次发送约100ms的音频
                const inputData = new Float32Array(bufferLength);
                analyser.getFloatTimeDomainData(inputData);
                
                // 初始化处理后的数据变量，确保在try-catch块外部可以访问
                let processedData;
                
                try {
                    // 使用全局音频数据管理器获取数据
                    // 如果全局数据不可用，则使用分析器数据
                    const globalAudioData = audioDataManager.get();
                    
                    // 选择使用哪个数据源
                    // 优先使用全局数据，如果大小合适
                    const realInputData = (globalAudioData && globalAudioData.length > 0) ? globalAudioData : inputData;
                    
                    // 直接使用原始音频数据，不添加噪声
                    let processedWithNoise = new Float32Array(realInputData.length);
                    for (let i = 0; i < realInputData.length; i++) {
                        processedWithNoise[i] = realInputData[i];
                    }
                    
                    // 应用音频增益 - 增加增益系数，确保信号强度足够
                    const gainFactor = 2.0; // 从1.5增加到2.0，确保信号强度足够
                    processedData = new Float32Array(processedWithNoise.length);
                    for (let i = 0; i < processedWithNoise.length; i++) {
                        // 应用增益，但确保不超过[-1,1]范围
                        processedData[i] = Math.max(-1.0, Math.min(1.0, processedWithNoise[i] * gainFactor));
                    }
                    console.log("已应用音频增益，系数：" + gainFactor);
                } catch (error) {
                    console.error("处理音频数据时出错:", error);
                    // 创建一个全是较强噪声的数组作为备用
                    processedData = new Float32Array(4096);
                    for (let i = 0; i < processedData.length; i++) {
                        processedData[i] = (Math.random() * 0.1 - 0.05);
                    }
                    console.log("使用备用噪声数据");
                }
                
                // 计算音频统计信息
                const stats = calculateAudioStats(processedData);
                
                // 检查音频数据是否有效
                const hasValidAudio = checkAudioData(processedData);
                console.log("音频数据检查结果: " + (hasValidAudio ? "有效" : "无效") + ", 峰值: " + stats.peak.toFixed(4));
                
                // 静音检测逻辑 - 只在自然对话模式下启用
                if (currentMode === 'natural') {
                    if (stats.peak > silenceThreshold) {
                        // 有声音活动，更新最后活动时间
                        lastAudioActivity = Date.now();
                        // 如果有静音定时器，清除它
                        if (silenceTimer) {
                            clearTimeout(silenceTimer);
                            silenceTimer = null;
                            console.log("检测到声音活动，重置静音计时器");
                        }
                    } else if (!silenceTimer && isRecording) {
                        // 如果没有声音活动且没有设置静音定时器，设置一个
                        console.log("检测到静音，开始计时...");
                        silenceTimer = setTimeout(() => {
                            console.log("静音超过" + (silenceTimeout/1000) + "秒，自动停止录音");
                            // 自动停止录音
                            stopRecording();
                            // 更新UI
                            if (micBtn) {
                                micBtn.classList.remove('bg-green-500');
                                micBtn.classList.add('bg-gray-200');
                                micStatus.textContent = "Off";
                            }
                        }, silenceTimeout);
                    }
                } else {
                    // 按住说话模式不需要静音检测
                    // 仅记录音频活动状态用于调试
                    if (stats.peak > silenceThreshold) {
                        lastAudioActivity = Date.now();
                    }
                }
                
                // 降低音频电平阈值，确保能发送数据
                // 始终发送数据，不论音频电平如何，确保识别器收到连续的数据流
                if (true) { // 始终发送数据，不再基于音频电平过滤
                        // 检查是否需要进行采样率转换
                    const targetSampleRate = 16000; // 后端期望的采样率
                    const currentSampleRate = audioContext.sampleRate;
                    
                    // 如果当前采样率不是16kHz，进行转换
                    let audioDataForConversion = processedData;
                    if (currentSampleRate !== targetSampleRate) {
                        audioDataForConversion = resampleAudio(processedData, currentSampleRate, targetSampleRate);
                        console.log(`已将音频从${currentSampleRate}Hz转换为${targetSampleRate}Hz，数据长度: ${processedData.length} -> ${audioDataForConversion.length}`);
                    }
                    
                    // 将Float32Array转换为Int16Array，使用处理过的数据
                    const pcmData = convertFloat32ToInt16(audioDataForConversion);
                    
                    // 发送到WebSocket
                    if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                        try {
                            // 检查数据是否全为零或非常小
                            let allZeros = true;
                            let maxValue = 0;
                            for (let i = 0; i < Math.min(100, pcmData.length); i++) {
                                const absValue = Math.abs(pcmData[i]);
                                if (absValue > 10) { // 增加阈值，确保有足够的信号
                                    allZeros = false;
                                }
                                maxValue = Math.max(maxValue, absValue);
                            }
                            
                            if (allZeros) {
                                console.warn("警告: 音频数据信号强度过低，最大值: " + maxValue);
                                // 如果信号太弱，添加一些人工信号确保识别器不会认为是静音
                                for (let i = 0; i < pcmData.length; i += 10) {
                                    pcmData[i] = 100 + Math.floor(Math.random() * 50);
                                }
                                console.log("已添加人工信号增强音频数据");
                            }
                            
                            // 使用阿里云标准格式发送音频数据
                            // 首先发送标准格式的音频数据头部信息
                            const audioHeader = {
                                header: {
                                    message_id: generateUUID(),
                                    task_id: sessionId,
                                    namespace: "SpeechRecognizer",
                                    name: "SendAudio"
                                },
                                payload: {
                                    format: "pcm",
                                    sample_rate: 16000,
                                    audio_chunk: "", // 空字符串，实际音频数据将作为二进制数据发送
                                    sequence_id: Date.now() // 使用时间戳作为序列ID
                                }
                            };
                            
                            // 尝试使用两种方式发送音频数据
                            // 方式1: 先发送头部信息，再发送音频数据
                            try {
                                recognitionSocket.send(JSON.stringify(audioHeader));
                                recognitionSocket.send(pcmData.buffer);
                                console.log("发送音频数据方式1成功");
                            } catch (error) {
                                console.error("发送音频数据方式1失败:", error);
                                
                                // 方式2: 直接发送原始数据（兼容旧方式）
                                try {
                                    recognitionSocket.send(pcmData.buffer);
                                    console.log("发送音频数据方式2成功");
                                } catch (error2) {
                                    console.error("发送音频数据方式2失败:", error2);
                                }
                            }
                            
                            // 更新最后发送时间
                            window.lastAudioSendTime = Date.now();
                            
                            // 记录发送的数据信息
                            console.log("已发送音频数据: " + pcmData.length + " 字节" + (allZeros ? " (警告: 数据全为零)" : ""));
                            console.log("音频统计: RMS=" + stats.rms.toFixed(4) + 
                                      ", 峰值=" + stats.peak.toFixed(4) + 
                                      ", 平均=" + stats.avg.toFixed(4));
                        } catch (error) {
                            console.error("发送音频数据失败:", error);
                        }
                    } else {
                        console.warn("WebSocket未连接，无法发送音频数据");
                        clearInterval(sendInterval);
                    }
                } 
            }, 100); // 每100ms发送一次数据，符合阿里云SDK建议的发送间隔
            
            // 注意：这里不再重复定义onaudioprocess，避免覆盖前面的定义
            // 前面已经定义了processor.onaudioprocess，它会安全地更新audioDataManager
            
            // 添加音频电平可视化
            setupAudioVisualization(source);
            
            isRecording = true;
            addMessage("系统", "开始录音", "system");
        })
        .catch(function(error) {
            console.error('获取麦克风失败:', error);
            
            // 根据错误类型显示不同的提示
            let errorMessage = '无法访问麦克风';
            let detailedMessage = '无法访问麦克风，请检查浏览器设置';
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage = '麦克风权限被拒绝';
                detailedMessage = '麦克风权限被拒绝。请点击地址栏中的锁定图标，并允许麦克风访问。然后刷新页面重试。';
                
                // 添加帮助按钮
                const helpBtn = document.createElement('button');
                helpBtn.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4';
                helpBtn.textContent = '如何允许麦克风权限';
                helpBtn.onclick = function() {
                    const instructions = document.createElement('div');
                    instructions.className = 'fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50';
                    instructions.innerHTML = `
                        <div class="bg-white p-6 rounded-lg max-w-lg w-full">
                            <h3 class="text-xl font-bold mb-4">如何允许麦克风权限</h3>
                            <ol class="list-decimal pl-5 space-y-2">
                                <li>点击浏览器地址栏中的锁定图标</li>
                                <li>在弹出的设置中，找到麦克风权限并允许</li>
                                <li>刷新页面并再次尝试</li>
                            </ol>
                            <!-- 我们不应该在这里添加这些元素，它们已经在其他地方存在 -->
                            <div class="mt-6 text-center">
                                <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onclick="this.parentElement.parentElement.remove()">关闭</button>
                                <button class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-4" onclick="location.reload()">刷新页面</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(instructions);
                };
                
                // 将按钮添加到状态区域
                const statusArea = document.querySelector('main');
                if (statusArea) {
                    statusArea.appendChild(helpBtn);
                }
                
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage = '未找到麦克风设备';
                detailedMessage = '未找到麦克风设备。请确保您的设备已连接麦克风并且工作正常。';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage = '麦克风正被其他应用程序使用';
                detailedMessage = '麦克风正被其他应用程序使用。请关闭可能正在使用麦克风的其他应用程序，然后重试。';
            } else if (error.name === 'AbortError') {
                errorMessage = '麦克风访问被中止';
                detailedMessage = '麦克风访问请求被中止。请刷新页面并重试。';
            } else if (error.name === 'SecurityError') {
                errorMessage = '安全限制阻止麦克风访问';
                detailedMessage = '由于安全限制，无法访问麦克风。请确保您在HTTPS或localhost环境下运行此应用。';
            } else if (error.name === 'TypeError') {
                errorMessage = '麦克风访问参数错误';
                detailedMessage = '请求麦克风访问时参数错误。这可能是浏览器兼容性问题。';
            }
            
            // 更新状态文本
            statusText.textContent = errorMessage;
            
            // 显示详细错误信息
            addMessage('系统', detailedMessage, 'error');
            
            // 不自动清除错误状态，保持错误提示直到用户重试
            
            // 重置麦克风按钮状态
            micBtn.classList.remove('bg-green-500');
            micBtn.classList.add('bg-gray-200');
            micStatus.textContent = "Off";
        });
}

/**
 * 开始心跳
 * 按照阿里云要求，每10秒发送一次心跳消息避免IDLE_TIMEOUT
 */
function startHeartbeat() {
    // 清除可能存在的心跳定时器
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    
    // 清除可能存在的超时定时器
    if (heartbeatTimeoutTimer) {
        clearTimeout(heartbeatTimeoutTimer);
        heartbeatTimeoutTimer = null;
    }
    
    // 设置新的心跳定时器 - 每10秒发送一次心跳
    const HEARTBEAT_INTERVAL = 10000; // 10秒，符合阿里云要求
    
    heartbeatTimer = setInterval(() => {
        if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
            // 发送心跳消息
            const heartbeatMsg = {
                type: "heartbeat",
                timestamp: Date.now()
            };
            
            try {
                recognitionSocket.send(JSON.stringify(heartbeatMsg));
                console.log("发送心跳消息:", heartbeatMsg.timestamp);
                
                // 设置心跳超时检测
                if (heartbeatTimeoutTimer) {
                    clearTimeout(heartbeatTimeoutTimer);
                }
                
                heartbeatTimeoutTimer = setTimeout(() => {
                    console.warn("心跳响应超时，可能连接已断开");
                    // 检查连接状态
                    if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                        console.log("尝试重新发送心跳...");
                        // 不做任何操作，让下一次心跳继续尝试
                    } else {
                        console.error("WebSocket连接已关闭，尝试重连");
                        // 尝试重连
                        if (isCallActive) {
                            attemptReconnect();
                        }
                    }
                }, 5000); // 5秒超时
                
            } catch (error) {
                console.error("发送心跳消息失败:", error);
                // 如果发送失败，可能是连接已断开
                if (isCallActive) {
                    attemptReconnect();
                }
            }
        } else {
            console.warn("WebSocket未连接，无法发送心跳");
            // 如果连接已断开，尝试重连
            if (isCallActive) {
                attemptReconnect();
            }
        }
    }, HEARTBEAT_INTERVAL);
}

/**
 * 停止WebSocket心跳
 */
function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        console.log("心跳定时器已停止");
    }
    
    if (heartbeatTimeoutTimer) {
        clearTimeout(heartbeatTimeoutTimer);
        heartbeatTimeoutTimer = null;
        console.log("心跳超时定时器已停止");
    }
}

/**
 * 尝试重连 WebSocket
 */
function attemptReconnect() {
    reconnectAttempts++;
    
    // 更新状态显示
    statusText.textContent = `正在重连... (尝试 ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`;
    connectionStatus.textContent = `重连中...`;
    
    // 使用指数退避策略计算延迟
    const currentDelay = reconnectDelay * Math.pow(1.5, reconnectAttempts - 1);
    console.log(`将在 ${currentDelay}ms 后尝试重连`);
    
    // 设置重连定时器
    reconnectTimer = setTimeout(() => {
        // 如果用户已经手动结束通话，不再重连
        if (!isCallActive) {
            console.log('通话已结束，取消重连');
            return;
        }
        
        console.log(`尝试重连，第 ${reconnectAttempts} 次`);
        initRecognitionWebSocket();
    }, currentDelay);
}

/**
 * 启动通话计时器
 */
function startCallTimer() {
    // 重置计时器
    stopCallTimer();
    
    // 记录开始时间
    callStartTime = Date.now();
    callDuration = 0;
    
    // 更新计时器显示
    updateCallTimerDisplay();
    
    // 启动定时器
    callTimer = setInterval(updateCallTimerDisplay, 1000);
}

/**
 * 停止通话计时器
 */
function stopCallTimer() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
}

/**
 * 更新计时器显示
 */
function updateCallTimerDisplay() {
    if (!callStartTime) return;
    
    // 计算已经过去的时间（秒）
    callDuration = Math.floor((Date.now() - callStartTime) / 1000);
    
    // 格式化为 mm:ss
    const minutes = Math.floor(callDuration / 60);
    const seconds = callDuration % 60;
    
    // 更新显示
    callTimerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 调用语音合成API
 * @param {string} text 要合成的文本
 */
function synthesizeSpeech(text) {
    if (!text || text.trim() === '') {
        console.warn('语音合成文本为空');
        return;
    }
    
    console.log('发送语音合成请求，文本：', text);
    
    // 方式1：使用WebSocket发送文本到后端进行合成
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(text);
        // 显示状态提示
        statusText.textContent = '正在合成语音...';
    } else {
        console.error('语音合成WebSocket未连接，尝试使用HTTP API');
        
        // 显示状态提示
        statusText.textContent = '正在合成语音(HTTP)...';
        
        // 方式2：使用HTTP API调用语音合成
        fetch('/api/voice/synthesize', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: text
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP 错误：${response.status}`);
            }
            return response.arrayBuffer();
        })
        .then(arrayBuffer => {
            // 播放合成的语音
            playAudio(arrayBuffer);
            statusText.textContent = 'Ready to talk...';
        })
        .catch(error => {
            console.error('语音合成请求失败：', error);
            addMessage('错误', '语音合成失败', 'error');
            statusText.textContent = '语音合成失败';
            setTimeout(() => {
                statusText.textContent = 'Ready to talk...';
            }, 3000);
        });
    }
}

/**
 * 添加语音合成测试按钮
 */
function addSynthesisTestButton() {
    const controlsContainer = document.querySelector('.call-controls') || document.body;
    
    // 创建测试按钮
    const testButton = document.createElement('button');
    testButton.className = 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded ml-2';
    testButton.textContent = '测试语音合成';
    testButton.id = 'testSynthesisBtn';
    
    // 添加点击事件
    testButton.addEventListener('click', function() {
        // 测试语音合成
        synthesizeSpeech(testSynthesisText);
        addMessage('system', '测试语音合成: ' + testSynthesisText, 'system');
    });
    
    // 添加到控制区
    controlsContainer.appendChild(testButton);
}

/**
 * 开始通话
 */
function startCall() {
    // 重置重连计数
    reconnectAttempts = 0;
    
    // 初始化WebSocket连接
    initSynthesisWebSocket();
    initRecognitionWebSocket();
    
    // 启动计时器
    startCallTimer();
    
    // 更新状态
    statusText.textContent = "正在连接...";
    connectionStatus.textContent = "连接中...";
    
    // 更新按钮状态
    isCallActive = true;
    updateCallButtonUI(true);
    
    // 如果是自然对话模式，自动开始录音
    if (currentMode === 'natural') {
        console.log('自然对话模式，自动开始录音');
        // 使用setTimeout等待WebSocket连接建立
        setTimeout(() => {
            startRecording();
            micBtn.classList.remove('bg-gray-200');
            micBtn.classList.add('bg-green-500');
            micStatus.textContent = "On";
            statusText.textContent = "You Talk, I'm Listening...";
        }, 1000);
    }
}

/**
 * 结束通话
 */
function endCall() {
    // 停止录音
    if (isRecording) {
        stopRecording();
        micBtn.classList.remove('bg-green-500');
        micBtn.classList.add('bg-gray-200');
        micStatus.textContent = "Off";
    }
    
    // 延迟关闭语音识别WebSocket连接，确保后端有足够时间处理最终识别结果
    if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
        console.log('延迟3000毫秒关闭语音识别WebSocket连接');
        setTimeout(() => {
            console.log('关闭语音识别WebSocket连接');
            if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                recognitionSocket.close();
            }
        }, 3000); // 延迟3秒关闭，给后端更多时间处理回调
    }
    
    // 关闭主WebSocket连接
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    
    // 清除所有计时器
    stopCallTimer();
    stopHeartbeat();
    
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    // 更新状态
    statusText.textContent = "通话已结束";
    connectionStatus.textContent = "已挂断";
    
    // 更新按钮状态
    isCallActive = false;
    updateCallButtonUI(false);
}

/**
 * 更新通话按钮状态
 */
function updateCallButtonState(isActive) {
    isCallActive = isActive;
    updateCallButtonUI(isActive);
}

/**
 * 更新通话按钮UI
 */
function updateCallButtonUI(isActive) {
    if (isActive) {
        callBtn.classList.remove('bg-green-500');
        callBtn.classList.add('bg-red-500');
        callIcon.classList.add('hidden');
        hangupIcon.classList.remove('hidden');
    } else {
        callBtn.classList.remove('bg-red-500');
        callBtn.classList.add('bg-green-500');
        callIcon.classList.remove('hidden');
        hangupIcon.classList.add('hidden');
    }
}

/**
 * 通话按钮点击处理
 */
function handleCallButtonClick() {
    if (isCallActive) {
        endCall();
    } else {
        startCall();
    }
}

/**
 * 采样率转换函数
 * 将音频数据从原始采样率转换为目标采样率
 * 使用线性插值法提高转换质量
 */
function resampleAudio(audioData, originalSampleRate, targetSampleRate) {
    // 如果采样率相同，无需转换
    if (originalSampleRate === targetSampleRate) {
        return audioData;
    }
    
    console.log(`正在进行采样率转换: ${originalSampleRate}Hz -> ${targetSampleRate}Hz`);
    
    // 计算采样率比例
    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    
    // 使用线性插值法进行重采样
    // 这种方法比简单的点采样效果更好
    for (let i = 0; i < newLength; i++) {
        const position = i * ratio;
        const index = Math.floor(position);
        const fraction = position - index;
        
        // 线性插值
        if (index + 1 < audioData.length) {
            result[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
        } else {
            result[i] = audioData[index];
        }
    }
    
    return result;
}

/**
 * 将Float32Array转换为Int16Array
 * 这是将浮点音频数据转换为16位整数PCM格式
 * 适配阿里云语音识别服务的要求
 */
function convertFloat32ToInt16(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    
    // 检查音频数据的强度
    let maxAbs = 0;
    for (let i = 0; i < float32Array.length; i++) {
        maxAbs = Math.max(maxAbs, Math.abs(float32Array[i]));
    }
    
    // 判断是否需要添加噪声
    // 当音频数据很弱时（接近静音），添加小量噪声以确保数据有效
    const isVeryQuiet = maxAbs < 0.01;
    const addNoise = true; // 始终添加小量噪声，确保数据不全为零
    
    for (let i = 0; i < float32Array.length; i++) {
        // 获取原始样本值
        let sample = float32Array[i];
        
        // 如果音频很弱或启用噪声选项，添加小量噪声
        if (addNoise) {
            // 很弱的音频添加稍大一点的噪声，正常音频添加很小的噪声
            const noiseAmount = isVeryQuiet ? 0.02 : 0.005;
            sample += (Math.random() * noiseAmount * 2 - noiseAmount);
        }
        
        // 应用增益，增强很弱的音频
        if (isVeryQuiet) {
            sample *= 1.5; // 增强50%
        }
        
        // 限制在[-1, 1]范围内
        const s = Math.max(-1, Math.min(1, sample));
        
        // 转换为16位整数，范围[-32768, 32767]
        int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    return int16Array;
}

/**
 * 检查音频数据是否有效
 */
function checkAudioData(audioData) {
    // 检查是否有足够的非零值
    let nonZeroCount = 0;
    const threshold = 0.01; // 允许的最小非零值
    
    for (let i = 0; i < audioData.length; i++) {
        if (Math.abs(audioData[i]) > threshold) {
            nonZeroCount++;
        }
    }
    
    // 降低有效性判断标准，只要有1%的样本大于阈值就认为有效
    // 这样可以确保注入噪声后的数据被识别为有效
    return nonZeroCount > audioData.length * 0.01;
}

/**
 * 计算音频统计信息
 */
function calculateAudioStats(audioData) {
    let sum = 0;
    let peak = 0;
    
    for (let i = 0; i < audioData.length; i++) {
        const abs = Math.abs(audioData[i]);
        sum += abs;
        peak = Math.max(peak, abs);
    }
    
    const avg = sum / audioData.length;
    const rms = Math.sqrt(audioData.reduce((acc, val) => acc + val * val, 0) / audioData.length);
    
    return { avg, peak, rms };
}

/**
 * 确保UI元素存在
 */
function ensureUIElements() {
    // 检查并创建状态文本元素
    if (!document.getElementById('statusText')) {
        console.log('创建状态文本元素');
        const statusContainer = document.createElement('div');
        statusContainer.className = 'status-container';
        statusContainer.style.margin = '10px';
        statusContainer.style.padding = '5px';
        statusContainer.style.backgroundColor = '#f8f9fa';
        statusContainer.style.borderRadius = '5px';
        statusContainer.style.textAlign = 'center';
        
        const statusTextElement = document.createElement('div');
        statusTextElement.id = 'statusText';
        statusTextElement.textContent = '准备就绪';
        statusContainer.appendChild(statusTextElement);
        
        // 尝试找到合适的容器添加状态元素
        const container = document.querySelector('main') || document.body;
        container.insertBefore(statusContainer, container.firstChild);
        
        // 更新全局状态文本引用
        statusText = document.getElementById('statusText');
    }
    
    // 检查麦克风按钮
    if (!document.getElementById('micButton')) {
        console.log('创建麦克风按钮');
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';
        buttonContainer.style.margin = '10px';
        buttonContainer.style.textAlign = 'center';
        
        const micButton = document.createElement('button');
        micButton.id = 'micButton';
        micButton.className = 'bg-gray-200 p-2 rounded-full';
        micButton.innerHTML = '<i class="fas fa-microphone"></i>';
        micButton.style.width = '50px';
        micButton.style.height = '50px';
        micButton.style.borderRadius = '50%';
        micButton.style.border = 'none';
        micButton.style.cursor = 'pointer';
        buttonContainer.appendChild(micButton);
        
        // 添加麦克风状态文本
        const micStatusElement = document.createElement('div');
        micStatusElement.id = 'micStatus';
        micStatusElement.textContent = '点击开始录音';
        micStatusElement.style.marginTop = '5px';
        buttonContainer.appendChild(micStatusElement);
        
        // 尝试找到合适的容器添加麦克风按钮
        const statusContainer = document.querySelector('.status-container');
        if (statusContainer) {
            statusContainer.parentNode.insertBefore(buttonContainer, statusContainer.nextSibling);
        } else {
            const container = document.querySelector('main') || document.body;
            container.appendChild(buttonContainer);
        }
        
        // 更新全局麦克风按钮和状态引用
        micBtn = document.getElementById('micButton');
        micStatus = document.getElementById('micStatus');
        
        // 重新设置事件监听器
        setupEventListeners();
    }
}

/**
 * 停止录音
 */
function stopRecording() {
    if (!isRecording) {
        console.log('录音已经停止');
        return;
    }
    
    console.log('停止录音');
    isRecording = false;
    
    // 停止音频可视化
    if (window.audioVisualizationFrame) {
        cancelAnimationFrame(window.audioVisualizationFrame);
        window.audioVisualizationFrame = null;
    }
    
    // 清除音频保活定时器
    if (window.audioKeepAliveTimer) {
        clearInterval(window.audioKeepAliveTimer);
        window.audioKeepAliveTimer = null;
        console.log('音频保活定时器已清除');
    }
    
    // 关闭当前音频轨道
    if (currentAudioTrack) {
        currentAudioTrack.stop();
        currentAudioTrack = null;
    }
    
    // 关闭当前音频流
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    // 断开分析器连接
    if (window.currentAnalyser) {
        try {
            window.currentAnalyser.disconnect();
            window.currentAnalyser = null;
            console.log('发送最后一个音频数据包');
            
            // 等待一下再发送结束信号
            setTimeout(() => {
                if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                    // 发送阿里云标准格式的结束信号
                    const endMessage = {
                        header: {
                            message_id: generateUUID(),
                            task_id: sessionId,
                            namespace: "SpeechRecognizer",
                            name: "StopRecognition"
                        },
                        payload: {}
                    };
                    
                    // 发送阿里云标准格式的结束信号
                    recognitionSocket.send(JSON.stringify(endMessage));
                    console.log('发送阿里云标准格式结束信号:', endMessage);
                    
                    // 同时发送本地格式的结束信号（兼容旧代码）
                    recognitionSocket.send(JSON.stringify({
                        type: "end"
                    }));
                    console.log('发送本地格式结束信号');
                }
            }, 500); // 等待500ms再发送结束信号
        } catch (error) {
            console.error('发送最后数据包失败:', error);
            // 如果发送最后数据包失败，直接发送结束信号
            recognitionSocket.send(JSON.stringify({
                type: "end"
            }));
        }
        
        console.log('等待后端处理最终识别结果...');
        // 添加状态提示
        addMessage('系统', '正在处理语音识别结果...', 'system');
    }
}

/**
 * 设置音频可视化
 */
function setupAudioVisualization(source) {
    try {
        // 创建分析器节点
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        // 保存分析器引用，以便在停止录音时断开连接
        window.currentAnalyser = analyser;
        
        // 确保UI元素存在
        ensureUIElements();
        
        // 获取音频电平显示元素
        const audioLevelElement = document.getElementById('audioLevel');
        if (!audioLevelElement) {
            console.log('创建音频电平显示元素');
            // 创建音频电平显示元素
            const levelContainer = document.createElement('div');
            levelContainer.id = 'audioLevelContainer';
            levelContainer.style.width = '100%';
            levelContainer.style.height = '20px';
            levelContainer.style.backgroundColor = '#f0f0f0';
            levelContainer.style.borderRadius = '10px';
            levelContainer.style.overflow = 'hidden';
            levelContainer.style.margin = '10px 0';
            
            const level = document.createElement('div');
            level.id = 'audioLevel';
            level.style.height = '100%';
            level.style.width = '0%';
            level.style.backgroundColor = '#4CAF50';
            level.style.transition = 'width 0.1s';
            
            levelContainer.appendChild(level);
            
            // 将音频电平显示添加到页面
            // 尝试不同的选择器找到合适的容器
            let statusElement = document.querySelector('.status-container');
            if (!statusElement) {
                const statusText = document.getElementById('statusText');
                if (statusText) {
                    statusElement = statusText.parentElement;
                }
            }
            if (!statusElement) {
                statusElement = document.querySelector('main');
            }
            
            if (statusElement) {
                statusElement.appendChild(levelContainer);
                console.log('音频电平显示已添加到页面');
            } else {
                console.warn('找不到合适的容器来放置音频电平显示');
                // 创建一个新的容器并添加到body
                const container = document.createElement('div');
                container.className = 'status-container';
                container.style.margin = '10px';
                container.appendChild(levelContainer);
                document.body.appendChild(container);
                console.log('已创建新的状态容器并添加到页面');
            }
        }
        
        // 创建数据数组
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        // 更新音频电平显示
        function updateAudioLevel() {
            if (!isRecording) {
                // 如果不再录音，重置音频电平显示并停止更新
                const audioLevelElement = document.getElementById('audioLevel');
                if (audioLevelElement) {
                    audioLevelElement.style.width = '0%';
                }
                return;
            }
            
            // 获取音频数据
            analyser.getByteFrequencyData(dataArray);
            
            // 计算平均音频电平
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            
            // 将音频电平映射到百分比
            const levelPercentage = (average / 255) * 100;
            
            // 更新音频电平显示
            const audioLevelElement = document.getElementById('audioLevel');
            if (audioLevelElement) {
                audioLevelElement.style.width = levelPercentage + '%';
                
                // 根据音频电平调整颜色
                if (levelPercentage < 30) {
                    audioLevelElement.style.backgroundColor = '#4CAF50'; // 绿色
                } else if (levelPercentage < 70) {
                    audioLevelElement.style.backgroundColor = '#FFC107'; // 黄色
                } else {
                    audioLevelElement.style.backgroundColor = '#F44336'; // 红色
                }
            }
            
            // 记录音频电平信息
            if (Math.random() < 0.05) { // 只记录5%的样本，避免日志过多
                console.log('当前音频电平:', levelPercentage.toFixed(1) + '%');
            }
            
            // 循环更新
            window.audioVisualizationFrame = requestAnimationFrame(updateAudioLevel);
        }
        
        // 开始更新音频电平
        updateAudioLevel();
        
        // 定义全局函数，使其可在其他地方访问
        window.showAudioLevels = function(level) {
            const audioLevelElement = document.getElementById('audioLevel');
            if (audioLevelElement) {
                // 确保level在0-100范围内
                const safeLevel = Math.max(0, Math.min(100, level));
                audioLevelElement.style.width = safeLevel + '%';
                
                // 根据音频电平调整颜色
                if (safeLevel < 30) {
                    audioLevelElement.style.backgroundColor = '#4CAF50'; // 绿色
                } else if (safeLevel < 70) {
                    audioLevelElement.style.backgroundColor = '#FFC107'; // 黄色
                } else {
                    audioLevelElement.style.backgroundColor = '#F44336'; // 红色
                }
            }
        };
        
    } catch (error) {
        console.error('创建音频可视化失败:', error);
    }
}

/**
 * 资源清理 & 统一错误处理
 */
function cleanupResources() {
    // 停止心跳和超时检测
    stopHeartbeat();
    // 停止音频保活定时器
    if (window.audioKeepAliveTimer) {
        clearInterval(window.audioKeepAliveTimer);
        window.audioKeepAliveTimer = null;
    }
    updateSessionState({ status: 'closed' });
}

function handleRecognitionError(error) {
    console.error('语音识别错误:', error);
    updateSessionState({ status: 'error' });
    statusText.textContent = '连接错误';
    cleanupResources();
    // 自动重连
    if (isCallActive && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        attemptReconnect();
    }
}
