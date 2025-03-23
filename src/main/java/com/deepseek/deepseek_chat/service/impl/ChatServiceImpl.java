package com.deepseek.deepseek_chat.service.impl;

import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationParam;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.common.Role;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import com.deepseek.deepseek_chat.service.ChatService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.WebSocketSession;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import io.reactivex.Flowable;
import java.lang.StringBuilder;

@Service
public class ChatServiceImpl implements ChatService {
    
    private static final Logger logger = LoggerFactory.getLogger(ChatServiceImpl.class);
    
    @Value("${dashscope.api.key}")
    private String apiKey;
    
    @Autowired
    private Generation generation;
    
    // 使用 ConcurrentHashMap 存储会话历史
    private final ConcurrentHashMap<String, List<Message>> sessionHistory = new ConcurrentHashMap<>();
    
    // 创建统一的模型参数配置方法
    private GenerationParam createGenerationParam(List<Message> messages, boolean isStreaming) {
        return GenerationParam.builder()
                .apiKey(apiKey)
                .model("qwen-plus")
                .messages(messages)
                .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                .incrementalOutput(isStreaming)  // 仅在流式输出时启用
                .temperature(0.7f)
                .topP(0.9D)
                .build();
    }
    
    // 系统提示词
    private static final String SYSTEM_PROMPT = "你是通义千问助手，由阿里云开发。请用中文回答用户的问题。请始终保持这个身份，不要声称自己是其他模型（如GPT等）。\n\n"
            + "回答要求：\n"
            + "1. 首先用最简单的语言解释概念，就像向一个15岁的孩子解释一样\n"
            + "2. 识别出关键概念并突出显示\n"
            + "3. 通过具体的日常生活例子来类比说明\n"
            + "4. 指出概念之间的联系\n"
            + "5. 如果发现解释中有不清楚的部分，请重新组织语言\n"
            + "6. 最后总结核心要点\n"
            + "额外要求：\n"
            + "- 少使用专业术语，除非有必要（此时需要简单解释该术语）\n"
            + "- 多使用类比和比喻\n"
            + "- 适时提供简单的图表或示意\n"
            + "- 鼓励互动和提问\n"
            + "- 所有回答都应基于可靠来源，并提供引用和参考链接。";
    
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void addSession(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    @Override
    public void removeSession(WebSocketSession session) {
        sessions.remove(session.getId());
    }

    @Override
    public WebSocketSession getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    @Override
    public boolean hasSession(String sessionId) {
        return sessions.containsKey(sessionId);
    }
    
    @Override
    public String chat(String question, List<Message> history) throws NoApiKeyException, InputRequiredException {
        int maxRetries = 3;
        int currentRetry = 0;
        
        while (currentRetry < maxRetries) {
            try {
                // 添加用户新问题到历史记录
                Message userMessage = Message.builder()
                        .role(Role.USER.getValue())
                        .content(question)
                        .build();
                
                // 创建新的消息列表，包含历史记录和新消息
                List<Message> messages = new ArrayList<>();
                
                // 添加系统消息（如果历史记录为空）
                if (history.isEmpty()) {
                    Message systemMessage = Message.builder()
                            .role(Role.SYSTEM.getValue())
                            .content(SYSTEM_PROMPT)
                            .build();
                    messages.add(systemMessage);
                    history.add(systemMessage);
                }
                
                // 添加历史记录
                messages.addAll(history);
                // 添加新的用户消息
                messages.add(userMessage);
                
                // 使用统一的参数配置方法
                GenerationParam param = createGenerationParam(messages, false);
                
                // 调用API
                GenerationResult result = generation.call(param);
                
                // 获取AI回复
                String response = result.getOutput().getChoices().get(0).getMessage().getContent();
                
                // 将用户消息和AI回复添加到历史记录
                history.add(userMessage);
                Message assistantMessage = Message.builder()
                        .role(Role.ASSISTANT.getValue())
                        .content(response)
                        .build();
                history.add(assistantMessage);
                
                return response;
                
            } catch (ApiException e) {
                currentRetry++;
                logger.error("API调用失败，尝试第{}次重试，错误: {}", currentRetry, e.getMessage());
                
                if (currentRetry >= maxRetries) {
                    logger.error("达到最大重试次数，放弃重试");
                    throw e;
                }
                
                try {
                    // 指数退避，等待时间随重试次数增加
                    Thread.sleep((long) (Math.pow(2, currentRetry) * 1000));
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("重试等待被中断", ie);
                }
            } catch (NoApiKeyException | InputRequiredException e) {
                logger.error("致命错误，不进行重试: {}", e.getMessage());
                throw e;
            }
        }
        
        throw new RuntimeException("超过最大重试次数后仍然失败");
    }
    
    @Override
    public List<Message> createNewHistory() {
        List<Message> history = new ArrayList<>();
        Message systemMessage = Message.builder()
                .role(Role.SYSTEM.getValue())
                .content(SYSTEM_PROMPT)
                .build();
        history.add(systemMessage);
        return history;
    }
    
    @Override
    public void streamChat(String question, String sessionId, ChatCallback callback) {
        try {
            // 获取或创建会话历史
            final List<Message> messages = new ArrayList<>(sessionHistory.computeIfAbsent(sessionId, k -> {
                List<Message> newHistory = new ArrayList<>();
                // 添加系统提示词
                newHistory.add(Message.builder()
                    .role(Role.SYSTEM.getValue())
                    .content(SYSTEM_PROMPT)
                    .build());
                return newHistory;
            }));

            // 添加用户问题
            Message userMessage = Message.builder()
                    .role(Role.USER.getValue())
                    .content(question)
                    .build();
            messages.add(userMessage);

            // 使用统一的参数配置方法
            GenerationParam param = createGenerationParam(messages, true);

            // 创建Generation实例
            Generation gen = new Generation();
            
            // 使用流式调用
            Flowable<GenerationResult> result = gen.streamCall(param);
            StringBuilder finalContent = new StringBuilder();
            
            result.blockingForEach(message -> {
                try {
                    String content = message.getOutput().getChoices().get(0).getMessage().getContent();
                    if (!content.isEmpty()) {
                        // 发送增量内容
                        callback.onMessage(content);
                        finalContent.append(content);
                    }
                } catch (Exception e) {
                    logger.error("处理流式响应时出错", e);
                    callback.onError(e);
                }
            });

            // 保存到历史记录
            Message assistantMessage = Message.builder()
                    .role(Role.ASSISTANT.getValue())
                    .content(finalContent.toString())
                    .build();
            messages.add(assistantMessage);
            
            // 更新会话历史
            sessionHistory.put(sessionId, new ArrayList<>(messages));
            
            // 完成回调
            callback.onComplete();
            
        } catch (Exception e) {
            logger.error("流式聊天处理出错", e);
            callback.onError(e);
        }
    }

    @Override
    public void clearHistory(String sessionId) {
        sessionHistory.remove(sessionId);
    }

    @Override
    public List<Message> getHistory(String sessionId) {
        return sessionHistory.getOrDefault(sessionId, new ArrayList<>());
    }
} 