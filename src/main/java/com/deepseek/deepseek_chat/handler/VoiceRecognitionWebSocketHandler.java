package com.deepseek.deepseek_chat.handler;

import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import com.alibaba.nls.client.protocol.NlsClient;
import com.alibaba.nls.client.protocol.InputFormatEnum;
import com.alibaba.nls.client.protocol.SampleRateEnum;
import com.alibaba.nls.client.protocol.asr.SpeechTranscriber;
import com.alibaba.nls.client.protocol.asr.SpeechTranscriberListener;
import com.alibaba.nls.client.protocol.asr.SpeechTranscriberResponse;
import com.deepseek.deepseek_chat.service.VoiceChatService;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * WebSocket处理器，用于实时语音识别
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VoiceRecognitionWebSocketHandler extends AbstractWebSocketHandler {

    @Value("${aliyun.nls.appkey:${NLS_APP_KEY:}}")
    private String appKey;

    private final NlsClient nlsClient;
    private final ObjectMapper objectMapper;
    private final VoiceChatService voiceChatService;
    private final Map<String, SpeechTranscriber> recognizers = new ConcurrentHashMap<>();
    private final Map<String, Boolean> intelligentInterruptMap = new ConcurrentHashMap<>();
    // 添加会话状态跟踪，记录会话是否已关闭
    private final Map<String, Boolean> sessionClosedMap = new ConcurrentHashMap<>();
    // 添加会话ID与TaskID的映射，用于在识别完成时找到对应的会话ID
    private final Map<String, String> taskToSessionMap = new ConcurrentHashMap<>();
    // 添加定时任务执行器
    private final ScheduledExecutorService executorService = Executors.newSingleThreadScheduledExecutor();

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        log.info("语音识别WebSocket连接已建立: {}", session.getId());
        intelligentInterruptMap.put(session.getId(), false);
        // 初始化会话状态为未关闭
        sessionClosedMap.put(session.getId(), false);
        
        try {
            // 创建并启动识别器
            SpeechTranscriber recognizer = createRecognizer(session);
            recognizers.put(session.getId(), recognizer);
            recognizer.start();
            log.info("语音识别器已创建并启动: {}", session.getId());
        } catch (Exception e) {
            log.error("创建语音识别器时发生错误", e);
            try {
                Map<String, Object> message = new HashMap<>();
                message.put("type", "error");
                message.put("content", "创建语音识别器失败: " + e.getMessage());
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
            } catch (IOException ex) {
                log.error("发送错误消息时发生错误", ex);
            }
        }
    }

    @Override
    protected void handleBinaryMessage(@NonNull WebSocketSession session, @NonNull BinaryMessage message) {
        String sessionId = session.getId();
        ByteBuffer buffer = message.getPayload();
        int dataSize = buffer.remaining();
        long timestamp = System.currentTimeMillis();
        
        // 记录接收到的音频数据
        log.info("收到音频数据: 会话ID={}, 数据大小={}字节, 时间戳={}", sessionId, dataSize, timestamp);
        
        // 分析音频数据，检查是否包含有效的语音信号
        if (dataSize >= 100) { // 至少需要一些样本来分析
            byte[] audioData = new byte[Math.min(dataSize, 1000)]; // 取前1000字节进行分析
            int position = buffer.position();
            buffer.get(audioData, 0, audioData.length);
            buffer.position(position); // 重置位置，不影响后续处理
            
            // 计算音频能量，检测是否有声音
            double energy = calculateAudioEnergy(audioData);
            log.info("音频数据分析: 会话ID={}, 数据大小={}字节, 音频能量={}, 时间戳={}", 
                    sessionId, dataSize, energy, timestamp);
            
            // 如果能量超过阈值，可能包含语音
            if (energy > 100) {
                log.info("检测到可能的语音信号: 会话ID={}, 音频能量={}", sessionId, energy);
            }
            
            // 分析音频数据的前几个字节，检查是否有效
            if (audioData.length > 10) {
                StringBuilder hexDump = new StringBuilder("音频数据前10个字节: ");
                
                // 增强：检查是否全是0或接近0的值
                int zeroCount = 0;
                int sampleSize = Math.min(100, audioData.length);
                for (int i = 0; i < sampleSize; i++) {
                    if (audioData[i] == 0) {
                        zeroCount++;
                    }
                }
                
                // 如果大部分样本为0，记录警告并增强音频数据
                if (zeroCount > sampleSize * 0.9) {
                    log.warn("音频数据可能无效: {}%的样本为0，尝试增强信号", (zeroCount * 100 / sampleSize));
                    
                    // 为全零或接近零的数据添加微弱信号
                    byte[] enhancedData = new byte[buffer.remaining()];
                    buffer.get(enhancedData);
                    buffer.position(0); // 重置位置
                    
                    // 每隔几个样本添加一个非零值
                    for (int i = 0; i < enhancedData.length; i += 10) {
                        if (i + 1 < enhancedData.length) {
                            // 添加一个小的非零值
                            enhancedData[i] = (byte) (10 + (Math.random() * 20));
                            enhancedData[i+1] = (byte) (Math.random() * 10);
                        }
                    }
                    
                    // 使用增强后的数据
                    buffer = ByteBuffer.wrap(enhancedData);
                    log.info("已增强接近零的音频数据，添加了微弱信号");
                }
                
                for (int i = 0; i < Math.min(10, audioData.length); i++) {
                    hexDump.append(String.format("%02X ", audioData[i]));
                }
                log.debug(hexDump.toString());
            }
        }
        
        SpeechTranscriber recognizer = recognizers.get(sessionId);
        if (recognizer == null) {
            log.warn("未找到识别器，无法处理音频数据: {}", sessionId);
            try {
                // 尝试重新创建识别器
                log.info("尝试重新创建识别器: {}", sessionId);
                recreateRecognizer(session);
                
                // 获取新创建的识别器
                recognizer = recognizers.get(sessionId);
                if (recognizer == null) {
                    log.error("重新创建识别器失败: {}", sessionId);
                    return;
                }
                log.info("成功重新创建识别器: {}", sessionId);
            } catch (Exception e) {
                log.error("重新创建识别器时发生错误: {}", e.getMessage());
                return;
            }
        }
        
        try {
            // 发送音频数据到阿里云识别服务
            // 阿里云SDK要求将ByteBuffer转换为byte[]
            byte[] audioBytes = new byte[buffer.remaining()];
            buffer.get(audioBytes);
            buffer.position(0); // 重置位置以便于再次读取
            
            // 记录最后一次发送音频数据的时间戳
            long sendTime = System.currentTimeMillis();
            recognizer.send(audioBytes);
            log.info("已发送音频数据到阿里云: 会话ID={}, 数据大小={}字节, 发送时间={}", 
                    sessionId, audioBytes.length, sendTime);
        } catch (Exception e) {
            log.error("处理语音数据时发生错误: {}, 错误: {}", sessionId, e.getMessage(), e);
            try {
                session.sendMessage(new TextMessage("{\"type\":\"error\",\"content\":\"\u5904\u7406\u8bed\u97f3\u6570\u636e\u65f6\u53d1\u751f\u9519\u8bef\"}"));
                
                // 检查是否需要重新创建识别器
                if (e.getMessage() != null && 
                    (e.getMessage().contains("STATE_CLOSED") || 
                     e.getMessage().contains("Connection reset") || 
                     e.getMessage().contains("IDLE_TIMEOUT"))) {
                    log.warn("检测到连接问题，尝试重新创建识别器: {}", sessionId);
                    recreateRecognizer(session);
                }
            } catch (IOException ex) {
                log.error("发送错误消息时发生错误", ex);
            }
        }
    }

    /**
     * 计算音频数据的能量值，用于判断是否包含语音
     * @param audioData 音频数据字节数组
     * @return 能量值
     */
    private double calculateAudioEnergy(byte[] audioData) {
        // 假设数据是16位PCM格式
        double sum = 0;
        for (int i = 0; i < audioData.length - 1; i += 2) {
            // 将两个字节组合成一个16位整数
            short sample = (short) ((audioData[i] & 0xFF) | ((audioData[i + 1] & 0xFF) << 8));
            sum += Math.abs(sample);
        }
        return sum / (audioData.length / 2); // 平均能量
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        try {
            String payload = message.getPayload();
            log.info("收到文本消息: {}", payload);
            
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(payload, Map.class);
            String type = (String) data.get("type");
            
            if ("end".equals(type)) {
                // 结束当前识别
                closeRecognizer(session.getId());
            } else if ("config".equals(type)) {
                // 配置设置
                if (data.containsKey("interrupt")) {
                    Boolean interrupt = (Boolean) data.get("interrupt");
                    intelligentInterruptMap.put(session.getId(), interrupt);
                    log.info("设置智能打断: {}", interrupt);
                }
            } else if ("heartbeat".equals(type)) {
                // 处理心跳包
                log.debug("收到心跳包: {}", session.getId());
                try {
                    // 检查会话是否仍然有效
                    if (session.isOpen()) {
                        // 回复心跳包
                        Map<String, Object> response = new HashMap<>();
                        response.put("type", "heartbeat_ack");
                        response.put("timestamp", System.currentTimeMillis());
                        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
                        
                        // 向阿里云语音识别服务发送心跳数据
                        SpeechTranscriber recognizer = recognizers.get(session.getId());
                        if (recognizer != null) {
                            try {
                                // 发送一个有效的音频数据包，保持连接活跃
                                byte[] emptyAudioData = new byte[320]; // 10ms的16k采样率PCM数据
                                recognizer.send(emptyAudioData);
                                log.debug("已向阿里云服务发送心跳数据: {}", session.getId());
                            } catch (Exception e) {
                                log.warn("向阿里云服务发送心跳数据失败，可能需要重新创建识别器: {}", e.getMessage());
                                // 尝试重新创建识别器
                                recreateRecognizer(session);
                            }
                        } else {
                            log.warn("未找到识别器，尝试重新创建: {}", session.getId());
                            recreateRecognizer(session);
                        }
                    } else {
                        log.warn("会话已关闭，无法发送心跳响应: {}", session.getId());
                    }
                } catch (IOException e) {
                    log.error("发送心跳响应时发生错误", e);
                } catch (Exception e) {
                    log.error("处理心跳包时发生错误: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("处理配置消息时发生错误", e);
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        String sessionId = session.getId();
        log.info("语音识别WebSocket连接已关闭: {}, 状态: {}", sessionId, status);
        
        // 标记会话已关闭
        sessionClosedMap.put(sessionId, true);
        
        // 延迟关闭识别器，给识别结果回调更多时间（从500ms增加到1000ms）
        log.info("延迟1000毫秒关闭识别器，等待识别完成回调: {}", sessionId);
        executorService.schedule(() -> {
            log.info("延迟时间到，开始关闭识别器: {}", sessionId);
            safelyCloseRecognizer(sessionId);
            intelligentInterruptMap.remove(sessionId);
        }, 1000, TimeUnit.MILLISECONDS);
    }
    
    @Override
    public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) {
        log.error("WebSocket传输错误: {}, 异常: {}", session.getId(), exception.getMessage());
        // 发生传输错误时也要确保资源被释放
        safelyCloseRecognizer(session.getId());
        intelligentInterruptMap.remove(session.getId());
    }

    /**
     * 停止语音识别
     */
    private void closeRecognizer(String sessionId) {
        SpeechTranscriber recognizer = recognizers.remove(sessionId);
        if (recognizer != null) {
            // 分开处理stop和close操作，避免一个异常影响另一个操作
            try {
                recognizer.stop();
            } catch (Exception e) {
                // 忽略stop异常，可能是因为识别器已处于关闭状态
                log.debug("停止语音识别器时发生异常，可能已处于关闭状态: {}", e.getMessage());
            }
            
            try {
                recognizer.close();
                log.info("已关闭会话ID为{}的语音识别器", sessionId);
            } catch (Exception e) {
                log.error("关闭语音识别器资源时发生错误", e);
            }
        }
    }
    
    /**
     * 安全地关闭语音识别器，确保即使在异常情况下资源也能被释放
     */
    private void safelyCloseRecognizer(String sessionId) {
        try {
            closeRecognizer(sessionId);
        } catch (Exception e) {
            // 捕获所有可能的异常，确保不会影响WebSocket的关闭流程
            log.error("关闭语音识别器过程中发生未预期的异常: {}", e.getMessage());
            
            // 最后尝试直接从map中移除，确保不会有资源泄漏
            SpeechTranscriber recognizer = recognizers.remove(sessionId);
            if (recognizer != null) {
                try {
                    recognizer.close();
                } catch (Exception closeEx) {
                    log.error("最终尝试关闭语音识别器失败: {}", closeEx.getMessage());
                }
            }
        }
    }
    
    /**
     * 重新创建语音识别器
     * 用于处理连接超时或断开的情况，尝试重新建立连接
     */
    private void recreateRecognizer(WebSocketSession session) {
        String sessionId = session.getId();
        log.info("尝试重新创建语音识别器: {}", sessionId);
        
        // 先安全关闭旧的识别器
        safelyCloseRecognizer(sessionId);
        
        // 添加延迟，避免过快重连
        try {
            TimeUnit.MILLISECONDS.sleep(300);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        // 尝试创建新的识别器
        try {
            if (session.isOpen()) {
                SpeechTranscriber newRecognizer = createRecognizer(session);
                recognizers.put(sessionId, newRecognizer);
                newRecognizer.start();
                
                // 通知客户端重新连接成功
                Map<String, Object> reconnectMessage = new HashMap<>();
                reconnectMessage.put("type", "reconnect");
                reconnectMessage.put("content", "连接已重新建立");
                reconnectMessage.put("timestamp", System.currentTimeMillis());
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(reconnectMessage)));
                
                log.info("语音识别器重新创建成功: {}", sessionId);
            } else {
                log.warn("会话已关闭，无法重新创建识别器: {}", sessionId);
            }
        } catch (Exception e) {
            log.error("重新创建语音识别器失败: {}", e.getMessage());
            try {
                if (session.isOpen()) {
                    // 发送错误消息给客户端
                    Map<String, Object> errorMessage = new HashMap<>();
                    errorMessage.put("type", "error");
                    errorMessage.put("content", "重新连接失败: " + e.getMessage());
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(errorMessage)));
                }
            } catch (IOException ex) {
                log.error("发送错误消息时发生错误", ex);
            }
        }
    }

    /**
     * 创建语音识别器
     */
    private SpeechTranscriber createRecognizer(WebSocketSession session) throws Exception {
        SpeechTranscriber recognizer = new SpeechTranscriber(nlsClient, createListener(session));
        recognizer.setAppKey(appKey);
        recognizer.setFormat(InputFormatEnum.PCM);
        recognizer.setSampleRate(SampleRateEnum.SAMPLE_RATE_16K);
        recognizer.setEnableIntermediateResult(true);
        recognizer.setEnablePunctuation(true);
        
        // 启用完整句子识别和分词
        recognizer.addCustomedParam("enable_sentence_detection", true);
        recognizer.addCustomedParam("enable_words", true);
        
        // 设置通用模型，支持中英文混合识别
        // 通过自定义参数设置模型类型为通用模型
        recognizer.addCustomedParam("model", "universal");
        
        // 启用中英文混合识别
        recognizer.addCustomedParam("enable_inverse_text_normalization", true);
        recognizer.addCustomedParam("enable_mixed_language", true);
        
        // 启用语音活动检测
        recognizer.addCustomedParam("enable_voice_detection", true);
        
        // 延长识别超时时间 - 从5秒增加到8秒，提高容错性
        recognizer.addCustomedParam("speech_timeout", 8000);  // 8秒无语音超时
        
        // 增加音频发送间隔容忍度
        recognizer.addCustomedParam("max_start_silence", 10000); // 10秒起始静音容忍
        recognizer.addCustomedParam("max_end_silence", 2000);   // 2秒结束静音容忍
        
        // 设置静音能量阈值，降低以提高灵敏度
        recognizer.addCustomedParam("speech_noise_threshold", 200); // 默认值可能更高
        
        // 根据用户设置决定是否启用智能打断
        Boolean enableInterrupt = intelligentInterruptMap.getOrDefault(session.getId(), false);
        if (enableInterrupt) {
            // 设置智能打断相关参数
            recognizer.addCustomedParam("max_sentence_silence", 800);
            recognizer.addCustomedParam("enable_semantic_sentence_detection", true);
        }
        
        log.info("已创建语音识别器，启用中英文混合识别模式，会话ID: {}", session.getId());
        return recognizer;
    }

    /**
     * 创建语音识别监听器
     */
    private SpeechTranscriberListener createListener(WebSocketSession session) {
        return new SpeechTranscriberListener() {
            @Override
            public void onTranscriptionResultChange(SpeechTranscriberResponse response) {
                try {
                    String result = extractResult(response);
                    // 记录所有中间结果，即使是空结果
                    log.info("【语音识别中间结果】: '{}', 状态码: {}, 状态文本: {}", 
                            result, response.getStatus(), response.getStatusText());
                    
                    // 记录完整的响应对象信息
                    log.info("【语音识别中间响应】: 任务ID={}, 时间戳={}, 结果长度={}", 
                            response.getTaskId(), 
                            System.currentTimeMillis(),
                            (result != null ? result.length() : 0));
                    
                    Map<String, Object> message = new HashMap<>();
                    message.put("type", "interim");
                    message.put("content", result);
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
                } catch (IOException e) {
                    log.error("发送中间识别结果时发生错误", e);
                }
            }

            @Override
            public void onSentenceEnd(SpeechTranscriberResponse response) {
                try {
                    long timestamp = System.currentTimeMillis();
                    String taskId = response.getTaskId();
                    String sessionId = session.getId();
                    String result = extractResult(response);
                    
                    // 使用单引号包围结果，便于查看空白字符和空结果
                    log.info("【语音识别最终结果】: '{}', 时间戳: {}", result, timestamp);
                    
                    // 打印更详细的识别信息
                    log.info("【语音识别详情】: 任务ID={}, 会话ID={}, 结果长度={}, 状态码={}, 状态文本={}, 时间戳={}", 
                            taskId, 
                            sessionId,
                            (result != null ? result.length() : 0),
                            response.getStatus(),
                            response.getStatusText(),
                            timestamp);
                    
                    // 记录会话状态
                    boolean isSessionClosed = sessionClosedMap.getOrDefault(sessionId, false);
                    log.info("【会话状态】: 会话ID={}, 是否已关闭={}, WebSocket是否开启={}", 
                            sessionId, isSessionClosed, session.isOpen());
                    
                    // 记录完整的响应对象
                    log.info("【语音识别响应完整信息】: {}", response.toString());
                    
                    // 发送最终识别结果到前端
                    Map<String, Object> message = new HashMap<>();
                    message.put("type", "final");
                    message.put("content", result);
                    message.put("timestamp", timestamp);
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
                    
                    // 如果识别结果不为空，则调用语音对话服务处理并生成回复
                    if (result != null && !result.trim().isEmpty()) {
                        log.info("调用语音对话服务处理识别结果: '{}', 任务ID: {}, 时间戳: {}", result, taskId, timestamp);
                        voiceChatService.processAndRespond(result, session);
                    } else {
                        log.warn("识别结果为空，不调用语音对话服务, 任务ID: {}, 时间戳: {}", taskId, timestamp);
                    }
                } catch (IOException e) {
                    log.error("发送最终识别结果时发生错误: {}", e.getMessage(), e);
                }
            }
            
            @Override
            public void onTranscriptionComplete(SpeechTranscriberResponse response) {
                long timestamp = System.currentTimeMillis();
                String taskId = response.getTaskId();
                String sessionId = session.getId();
                
                log.info("【语音识别完成】- TaskId: {}, 会话ID: {}, 状态码: {}, 状态文本: {}", 
                        taskId, sessionId, response.getStatus(), response.getStatusText());
                
                // 记录完整响应
                log.info("【语音识别完成完整信息】: {}, 时间戳: {}", response.toString(), timestamp);
                
                // 检查会话状态
                boolean isSessionClosed = sessionClosedMap.getOrDefault(sessionId, false);
                log.info("【会话状态检查】- 会话ID: {}, 是否已标记为关闭: {}, WebSocket是否开启: {}, 时间戳: {}", 
                        sessionId, isSessionClosed, session.isOpen(), timestamp);
                
                String result = extractResult(response);
                
                log.info("【识别完成时的最终文本】: '{}', 文本长度: {}, 时间戳: {}", 
                        result, (result != null ? result.length() : 0), timestamp);
                
                // 如果有识别结果，处理它
                if (result != null && !result.trim().isEmpty()) {
                    log.info("【识别完成】处理识别结果: '{}', 任务ID: {}, 时间戳: {}", 
                            result, taskId, timestamp);
                    
                    try {
                        if (!isSessionClosed && session.isOpen()) {
                            // 如果会话还没关闭，正常处理
                            Map<String, Object> message = new HashMap<>();
                            message.put("type", "final");
                            message.put("content", result);
                            message.put("timestamp", timestamp);
                            message.put("source", "transcription_complete"); // 标记来源
                            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
                            
                            // 调用语音对话服务
                            log.info("调用语音对话服务处理识别结果: '{}', 任务ID: {}, 时间戳: {}", 
                                    result, taskId, timestamp);
                            voiceChatService.processAndRespond(result, session);
                        } else {
                            // 会话已关闭，记录识别结果但不发送
                            log.info("【会话已关闭】识别到有效结果，但无法发送: '{}', 任务ID: {}, 时间戳: {}", 
                                    result, taskId, timestamp);
                        }
                    } catch (Exception e) {
                        log.error("处理识别结果时出错: {}, 任务ID: {}, 时间戳: {}", 
                                e.getMessage(), taskId, timestamp, e);
                    }
                } else {
                    log.warn("识别结果为空，不处理, 任务ID: {}, 时间戳: {}", taskId, timestamp);
                    
                    // 即使结果为空，也发送一个空结果通知前端
                    try {
                        if (!isSessionClosed && session.isOpen()) {
                            Map<String, Object> message = new HashMap<>();
                            message.put("type", "empty_result");
                            message.put("timestamp", timestamp);
                            message.put("message", "未检测到语音内容");
                            message.put("taskId", taskId);
                            message.put("status", response.getStatus());
                            message.put("statusText", response.getStatusText());
                            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
                        }
                    } catch (Exception e) {
                        log.error("发送空结果通知时出错: {}", e.getMessage(), e);
                    }
                }
                
                // 清理任务ID到会话ID的映射
                taskToSessionMap.remove(taskId);
                log.info("【清理映射】已移除任务ID到会话ID的映射: 任务ID={}, 会话ID={}, 时间戳={}", 
                        taskId, sessionId, timestamp);
            }
            
            @Override
            public void onTranscriberStart(SpeechTranscriberResponse response) {
                String taskId = response.getTaskId();
                String sessionId = session.getId();
                
                log.info("【语音识别启动】- TaskId: {}, 会话ID: {}, 状态码: {}, 状态文本: {}", 
                        taskId, sessionId, response.getStatus(), response.getStatusText());
                
                // 建立任务ID和会话ID的映射关系
                taskToSessionMap.put(taskId, sessionId);
            }
            
            @Override
            public void onSentenceBegin(SpeechTranscriberResponse response) {
                log.info("【语音识别句子开始】- TaskId: {}, 状态码: {}, 状态文本: {}", 
                        response.getTaskId(), response.getStatus(), response.getStatusText());
                // 记录是否检测到语音活动
                String result = response.getTransSentenceText();
                log.info("【语音识别句子开始内容】: '{}', 长度: {}", 
                        result, (result != null ? result.length() : 0));
            }

            @Override
            public void onFail(SpeechTranscriberResponse response) {
                String errorMessage = response.getStatusText();
                int statusCode = response.getStatus();
                String taskId = response.getTaskId();
                
                log.error("语音识别失败 - TaskId: {}, 状态码: {}, 错误信息: {}", 
                    taskId, statusCode, errorMessage);
                
                try {
                    // 检查是否是空闲超时错误
                    if (errorMessage != null && errorMessage.contains("IDLE_TIMEOUT")) {
                        log.warn("检测到阿里云语音识别服务空闲超时，尝试重新创建识别器");
                        
                        // 安全关闭旧识别器
                        safelyCloseRecognizer(session.getId());
                        
                        // 尝试创建新的识别器
                        try {
                            SpeechTranscriber newRecognizer = createRecognizer(session);
                            recognizers.put(session.getId(), newRecognizer);
                            newRecognizer.start();
                            
                            // 通知客户端重新连接成功
                            Map<String, Object> reconnectMessage = new HashMap<>();
                            reconnectMessage.put("type", "reconnect");
                            reconnectMessage.put("content", "连接已重新建立");
                            reconnectMessage.put("timestamp", System.currentTimeMillis());
                            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(reconnectMessage)));
                            
                            log.info("语音识别器重新创建成功: {}", session.getId());
                            return; // 重新连接成功，不发送错误消息
                        } catch (Exception e) {
                            log.error("重新创建语音识别器失败: {}", e.getMessage());
                            errorMessage = "连接超时并且重连失败: " + e.getMessage();
                        }
                    }
                    
                    // 发送错误消息给客户端
                    Map<String, Object> message = new HashMap<>();
                    message.put("type", "error");
                    message.put("content", errorMessage);
                    session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
                } catch (IOException e) {
                    log.error("发送错误消息时发生错误", e);
                }
            }
        };
    }

    private static final String[] RESULT_KEYS = {"result", "text", "nbest", "unfixed_result", "fixed_result"};

    /**
     * 尝试从各种可能的字段中提取识别文本，彻底避免 null
     */
    private String extractResult(SpeechTranscriberResponse response) {
        // 1. 首选 SDK 提供的 getter
        String result = response.getTransSentenceText();
        if (result == null || result.trim().isEmpty()) {
            result = response.getTransSentenceFixedText();
        }
        if (result == null || result.trim().isEmpty()) {
            result = response.getTransSentenceUnfixedText();
        }

        if (result != null && !result.trim().isEmpty()) {
            return result;
        }

        // 2. 通过反射向上寻找 SpeechResProtocol.payload
        try {
            Class<?> clazz = response.getClass();
            while (clazz != null && !"SpeechResProtocol".equals(clazz.getSimpleName())) {
                clazz = clazz.getSuperclass();
            }
            if (clazz != null) {
                Field payloadField = clazz.getDeclaredField("payload");
                payloadField.setAccessible(true);
                Object payloadObj = payloadField.get(response);
                if (payloadObj instanceof java.util.Map) {
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> map = (java.util.Map<String, Object>) payloadObj;

                    // 打印一次完整payload，便于排查字段名
                    log.info("[Aliyun payload] {}", map);

                    for (String key : RESULT_KEYS) {
                        Object raw = map.get(key);
                        if (raw != null && !raw.toString().trim().isEmpty()) {
                            if (raw instanceof String) {
                                result = raw.toString();
                                break;
                            } else {
                                // 若是嵌套Map，再深入查找
                                String deep = deepFindText(raw);
                                if (deep != null) {
                                    result = deep;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // 兜底：遍历所有 entry，返回第一个可能的文本字段
                    if ((result == null || result.trim().isEmpty())) {
                        for (Map.Entry<String, Object> entry : map.entrySet()) {
                            Object v = entry.getValue();
                            if (v != null) {
                                String s = v.toString();
                                // 简单判断是否像句子（含字母或中文且长度>1）
                                if (s.matches(".*[a-zA-Z\u4e00-\u9fa5].*") && s.length() > 1 && s.length() < 200) {
                                    result = s;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.trace("extractResult 反射payload失败: {}", e.getMessage());
        }

        return result;
    }

    /**
     * 递归在对象(Map / List / String)中寻找可读文本
     */
    @SuppressWarnings("unchecked")
    private String deepFindText(Object obj) {
        if (obj == null) return null;
        if (obj instanceof String) {
            String s = ((String) obj).trim();
            if (!s.isEmpty()) return s;
            return null;
        }
        if (obj instanceof Map) {
            Map<Object, Object> mp = (Map<Object, Object>) obj;
            // 优先常见字段
            Object v = mp.get("text");
            if (v == null) v = mp.get("result");
            String fromField = deepFindText(v);
            if (fromField != null) return fromField;
            // 遍历所有 value
            for (Object o : mp.values()) {
                String r = deepFindText(o);
                if (r != null) return r;
            }
        }
        if (obj instanceof List) {
            for (Object o : (List<?>) obj) {
                String r = deepFindText(o);
                if (r != null) return r;
            }
        }
        return null;
    }

}
