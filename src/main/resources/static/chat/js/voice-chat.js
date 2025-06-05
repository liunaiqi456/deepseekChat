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

// DOM元素
const statusText = document.getElementById('statusText');
const callTimerElement = document.getElementById('callTimer');
const subtitleArea = document.getElementById('subtitleArea');
const subtitleText = document.getElementById('subtitleText');
const micBtn = document.getElementById('micBtn');
const callBtn = document.getElementById('callBtn');
const callIcon = document.getElementById('callIcon');
const hangupIcon = document.getElementById('hangupIcon');
const subtitleToggle = document.getElementById('subtitleToggle');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const interruptToggle = document.getElementById('interruptToggle');
const naturalMode = document.getElementById('naturalMode');
const pushToTalkMode = document.getElementById('pushToTalkMode');
const connectionStatus = document.getElementById('connectionStatus');
const micStatus = document.getElementById('micStatus');

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
        
        // 发送初始配置
        const config = {
            type: "config",
            interrupt: interruptToggle.checked
        };
        recognitionSocket.send(JSON.stringify(config));
        
        // 启动心跳
        startHeartbeat();
        
        // 初始化会话状态
        updateSessionState({
            id: Date.now(),
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
/**
 * 开始通话会话
 */
function startCall() {
    if (isCallActive) {
        console.log('通话已经处于活动状态');
        return;
    }

    console.log('开始新的通话会话');
    isCallActive = true;
    
    // 初始化WebSocket连接
    initRecognitionWebSocket();
    initSynthesisWebSocket();
    
    // 更新UI状态
    updateCallButtonState(true);
    if (statusText) statusText.textContent = '通话已开始';
    if (micStatus) micStatus.textContent = '准备就绪';
    
    // 添加系统消息
    addMessage('系统', '通话已开始，请说话...', 'system');
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
        e.stopPropagation(); // 防止事件冒泡
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
        // 确俚AudioContext可用
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        
        // 创建音频上下文，优化低延迟设置
        const audioContextOptions = {
            sampleRate: 16000,
            latencyHint: 'interactive'
        };
        
        audioContext = new AudioContext(audioContextOptions);
        console.log('音频上下文初始化成功，当前采样率:', audioContext.sampleRate, 'Hz');
        
        // 创建音频处理节点
        gainNode = audioContext.createGain();
        gainNode.gain.value = 1.0; // 初始增益设置为1.0
        
        // 创建分析器节点
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;
        analyserNode.smoothingTimeConstant = 0.8;
        
        // 连接节点
        gainNode.connect(analyserNode);
        analyserNode.connect(audioContext.destination);
        
        console.log('音频上下文已创建，采样率：', audioContext.sampleRate, 'Hz');
        
        // 检查实际采样率
        if (audioContext.sampleRate !== 16000) {
            console.warn("警告：浏览器不支持16kHz采样率，实际采样率为", audioContext.sampleRate, "Hz");
            console.log("将在发送音频数据前进行采样率转换");
        }
        console.warn("这可能导致语音识别质量下降，请考虑实现采样率转换");
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
            
            // 创建音频统计显示
            createAudioStatsDisplay();
            
            // 设置音频处理器回调
            let sampleCount = 0;
            const STATS_UPDATE_INTERVAL = 10; // 每处理10个音频块更新一次统计信息
            let currentAudioData = new Float32Array(bufferSize);
            
            // 添加音频处理事件，确保捕获原始音频数据
            processor.onaudioprocess = function(e) {
                try {
                    // 捕获输入缓冲区的数据
                    const inputData = e.inputBuffer.getChannelData(0);
                    
                    // 更新采样计数
                    sampleCount++;
                    
                    // 计算音频统计信息
                    if (sampleCount % STATS_UPDATE_INTERVAL === 0) {
                        calculateAudioStats(inputData);
                    }
                    
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
                
                console.log('当前音频上下文采样率:', audioContext.sampleRate, 'Hz');
                
                // 计算100ms对应的采样点数
                const samplesFor100ms = Math.ceil(audioContext.sampleRate * 0.1);
                console.log('100ms对应的采样点数:', samplesFor100ms);
                
                // 从全局音频管理器获取最新数据
                const inputData = audioDataManager.get();
                
                if (!inputData || inputData.length === 0) {
                    console.warn('没有可用的音频数据');
                    return;
                }
                
                console.log('获取到原始音频数据，长度:', inputData.length, '采样点');
                
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
                    
                    // 动态计算增益系数
                    const stats = calculateAudioStats(processedWithNoise);
                    let gainFactor = 1.0;
                    
                    // 如果音频能量太低，适当增加增益
                    if (stats.rms < 0.1) {
                        gainFactor = Math.min(1.5, 0.2 / stats.rms);
                    }
                    
                    // 采集音频数据
                    const audioData = new Float32Array(analyser.fftSize);
                    analyser.getFloatTimeDomainData(audioData);
                    
                    try {
                        // 使用音频处理函数
                        const processedData = processAudioData(audioData, audioContext.sampleRate);
                        
                        // 发送音频数据
                        if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                            const now = Date.now();
                            const timeSinceLastSend = now - (window.lastAudioSendTime || 0);
                            
                            if (timeSinceLastSend >= 100) { // 每100ms发送一次数据
                                console.log(`发送音频数据 - 间隔: ${timeSinceLastSend}ms, 长度: ${processedData.length}字节`);
                                recognitionSocket.send(processedData.buffer);
                                window.lastAudioSendTime = now;
                            }
                        } else {
                            console.warn('语音识别 WebSocket 连接不可用');
                        }
                        
                        // 更新音频电平可视化
                        if (typeof showAudioLevels === 'function') {
                            const stats = calculateAudioStats(audioData);
                            showAudioLevels(stats.rms);
                        }
                        
                    } catch (error) {
                        console.error('处理音频数据时出错:', error);
                        // 发送心跳包保持连接
                        if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                            recognitionSocket.send(JSON.stringify({ type: 'heartbeat' }));
                        }
                    }    
                    
                    // 尝试发送备用数据
                    if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                        try {
                            const resampledData = resampleAudio(processedData, audioContext.sampleRate, 16000);
                            const int16Data = convertFloat32ToInt16(resampledData);
                            recognitionSocket.send(int16Data.buffer);
                            console.log('备用音频数据发送成功');
                        } catch (sendError) {
                            console.error('发送备用数据失败:', sendError);
                        }
                    }
                } catch (error) {
                    console.error('处理音频数据时出错:', error);
                    // 创建一个全是较强噪声的数组作为备用
                    processedData = new Float32Array(4096);
                    for (let i = 0; i < processedData.length; i++) {
                        processedData[i] = (Math.random() * 0.1 - 0.05);
                    }
                    console.log('使用备用噪声数据');
                    
                    // 尝试发送备用数据
                    if (recognitionSocket && recognitionSocket.readyState === WebSocket.OPEN) {
                        try {
                            const resampledData = resampleAudio(processedData, audioContext.sampleRate, 16000);
                            const int16Data = convertFloat32ToInt16(resampledData);
                            recognitionSocket.send(int16Data.buffer);
                            console.log('备用音频数据发送成功');
                        } catch (sendError) {
                            console.error('发送备用数据失败:', sendError);
                        }
                    }
                }
            }, 100); // 每100ms发送一次数据
            
            // 设置音频可视化
            setupAudioVisualization(source);
            
            isRecording = true;
            addMessage('系统', '开始录音', 'system');
        });
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

/**
 * 计算音频统计信息
 * @param {Float32Array} audioData 音频数据
 * @returns {Object} 统计信息
 */
function calculateAudioStats(audioData) {
    let sum = 0;
    let sumSquares = 0;
    let zeroCrossings = 0;
    let peak = 0;
    
    for (let i = 0; i < audioData.length; i++) {
        const sample = audioData[i];
        sum += sample;
        sumSquares += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
        
        if (i > 0 && ((audioData[i] >= 0 && audioData[i - 1] < 0) || 
                      (audioData[i] < 0 && audioData[i - 1] >= 0))) {
            zeroCrossings++;
        }
    }
    
    const average = sum / audioData.length;
    const rms = Math.sqrt(sumSquares / audioData.length);
    const zeroCrossingRate = zeroCrossings / (audioData.length - 1);
    
    return {
        average: average,
        rms: rms,
        peak: peak,
        zeroCrossingRate: zeroCrossingRate
    };
}

/**
 * 重采样音频数据
 * @param {Float32Array} audioData 原始音频数据
 * @param {number} fromSampleRate 原始采样率
 * @param {number} toSampleRate 目标采样率
 * @returns {Float32Array} 重采样后的数据
 */
function resampleAudio(audioData, fromSampleRate, toSampleRate) {
    if (fromSampleRate === toSampleRate) {
        return audioData;
    }

    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    
    let offsetResult = 0;
    let offsetData = 0;
    
    while (offsetResult < result.length) {
        const indexData = Math.floor(offsetData);
        const alpha = offsetData - indexData;
        
        if (indexData + 1 < audioData.length) {
            result[offsetResult] = audioData[indexData] * (1 - alpha) + 
                                  audioData[indexData + 1] * alpha;
        } else {
            result[offsetResult] = audioData[indexData];
        }
        
        offsetResult++;
        offsetData += ratio;
    }
    
    return result;
}

/**
 * 显示音频电平
 * @param {number} rms RMS值（0-1之间）
 */
function showAudioLevels(rms) {
    const levelIndicator = document.getElementById('audioLevelIndicator');
    if (!levelIndicator) {
        // 创建音频电平指示器
        const indicator = document.createElement('div');
        indicator.id = 'audioLevelIndicator';
        indicator.style.position = 'absolute';
        indicator.style.bottom = '80px';
        indicator.style.left = '50%';
        indicator.style.transform = 'translateX(-50%)';
        indicator.style.width = '200px';
        indicator.style.height = '10px';
        indicator.style.backgroundColor = '#e5e7eb';
        indicator.style.borderRadius = '5px';
        indicator.style.overflow = 'hidden';
        
        const level = document.createElement('div');
        level.style.width = '0%';
        level.style.height = '100%';
        level.style.backgroundColor = '#10b981';
        level.style.transition = 'width 0.1s ease-out';
        level.id = 'audioLevel';
        
        indicator.appendChild(level);
        document.body.appendChild(indicator);
    }
    
    // 更新电平显示
    const level = document.getElementById('audioLevel');
    if (level) {
        // 将RMS值转换为百分比，并使用对数标度使显示更平滑
        const percentage = Math.min(100, Math.max(0, Math.log10(rms * 10 + 1) * 100));
        level.style.width = `${percentage}%`;
        
        // 根据电平调整颜色
        if (percentage < 30) {
            level.style.backgroundColor = '#10b981'; // 绿色
        } else if (percentage < 70) {
            level.style.backgroundColor = '#f59e0b'; // 黄色
        } else {
            level.style.backgroundColor = '#ef4444'; // 红色
        }
    }
}

/**
 * 添加语音合成测试按钮
 */
function addSynthesisTestButton() {
    const controlsContainer = document.querySelector('.control-area');
    if (!controlsContainer) {
        console.error('找不到控制按钮容器');
        return;
    }

    const testButton = document.createElement('button');
    testButton.className = 'test-synthesis-btn';
    testButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <span>测试语音</span>
    `;

    testButton.addEventListener('click', function() {
        // 初始化语音合成WebSocket
        const wsUrl = `ws://${window.location.host}/ws/voice/synthesis`;
        const synthesisSocket = new WebSocket(wsUrl);
        
        synthesisSocket.onopen = function() {
            console.log('语音合成WebSocket连接已建立');
            // 发送测试文本
            synthesisSocket.send(testSynthesisText);
            
            // 添加消息到聊天区域
            addMessage('系统', testSynthesisText, 'assistant');
        };
        
        let audioChunks = [];
        synthesisSocket.onmessage = function(event) {
            try {
                if (event.data instanceof Blob) {
                    // 收集音频数据块
                    audioChunks.push(event.data);
                } else {
                    // 处理状态消息
                    const message = JSON.parse(event.data);
                    if (message.type === 'complete') {
                        // 合成完成，播放所有音频数据
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        playAudio(audioBlob);
                        audioChunks = []; // 清空缓存
                        synthesisSocket.close();
                    } else if (message.type === 'error') {
                        console.error('语音合成错误:', message.message);
                        addMessage('系统', '语音合成失败: ' + message.message, 'error');
                        audioChunks = []; // 清空缓存
                    }
                }
            } catch (error) {
                console.error('处理语音合成数据时出错:', error);
                audioChunks = []; // 清空缓存
            }
        };
        
        synthesisSocket.onerror = function(error) {
            console.error('语音合成WebSocket错误:', error);
            addMessage('系统', '语音合成失败', 'error');
        };
        
        synthesisSocket.onclose = function() {
            console.log('语音合成WebSocket连接已关闭');
        };
    });

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .test-synthesis-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background-color: #4f46e5;
            color: white;
            border: none;
            border-radius: 0.375rem;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .test-synthesis-btn:hover {
            background-color: #4338ca;
        }
        .test-synthesis-btn svg {
            width: 1.5rem;
            height: 1.5rem;
        }
    `;
    document.head.appendChild(style);

    // 将按钮添加到控制区域
    controlsContainer.appendChild(testButton);
}

function handleRecognitionError(error) {
    console.error('语音识别错误:', error);
    addMessage('系统', '语音识别出错，请重试', 'error');
    
    // 清理资源
    cleanupResources();
    
    // 重置状态
    updateCallButtonState(false);
    isRecording = false;
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