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
import io.reactivex.disposables.Disposable;

@Service
public class ChatServiceImpl implements ChatService {
    
    private static final Logger logger = LoggerFactory.getLogger(ChatServiceImpl.class);
    
    @Value("${dashscope.api.key:${DASHSCOPE_API_KEY:}}")
    private String apiKey;
    
    @Autowired
    private Generation generation;
    
    @Autowired
    private HomeworkServiceImpl homeworkServiceImpl;
    
    // 使用 ConcurrentHashMap 存储会话历史
    private final ConcurrentHashMap<String, List<Message>> sessionHistory = new ConcurrentHashMap<>();
    
    // 保存每个sessionId的流式订阅
    private final Map<String, Disposable> streamDisposables = new ConcurrentHashMap<>();
    
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
    private static final String SYSTEM_PROMPT = "回答要求：\n"
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
            + "- 所有回答都应基于可靠来源，并提供引用和参考链接。数学题要分步骤解答，输出对这道题的思考判断过程。";
    
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
    
    /** 最大重试次数 */
    private static final int MAX_RETRIES = 3;

    @Override
    public String chat(String question, List<Message> history) throws NoApiKeyException, InputRequiredException {
        if (question == null || question.isEmpty()) {
            throw new InputRequiredException("问题不能为空");
        }
        
        Message userMessage = Message.builder()
                .role(Role.USER.getValue())
                .content(question)
                .build();
        
        int currentRetry = 0;
        while (currentRetry < MAX_RETRIES) {
            try {
                List<Message> messages = new ArrayList<>();
                if (history.isEmpty()) {
                    Message systemMessage = Message.builder()
                            .role(Role.SYSTEM.getValue())
                            .content(SYSTEM_PROMPT)
                            .build();
                    messages.add(systemMessage);
                    history.add(systemMessage);
                }
                messages.addAll(history);
                messages.add(userMessage);

                // 裁剪历史，保证不超tokens
                trimHistoryToFitTokens(messages, 129024);

                // 打印即将发送给qwen-plus的完整消息内容
                System.out.println("=== 发送给qwen-plus的messages ===");
                for (Message msg : messages) {
                    System.out.println("role: " + msg.getRole() + ", content: " + msg.getContent());
                }
                System.out.println("=== END ===");

                GenerationParam param = createGenerationParam(messages, false);
                GenerationResult result = generation.call(param);
                String response = result.getOutput().getChoices().get(0).getMessage().getContent();
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
                if (currentRetry >= MAX_RETRIES) {
                    logger.error("达到最大重试次数({})，放弃重试", MAX_RETRIES);
                    throw new RuntimeException("API调用失败，已重试" + MAX_RETRIES + "次", e);
                }
                try {
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
        // 注意：此行代码实际上永远不会被执行到，因为：
        // 1. 如果 MAX_RETRIES > 0，循环内部会在达到最大重试次数时抛出异常
        // 2. 如果成功，会在循环内部通过 return response 返回
        // 保留此检查仅作为防御性编程
        throw new RuntimeException("意外的执行流程：超过最大重试次数(" + MAX_RETRIES + ")后仍然失败");
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
    public void streamChat(String question, String sessionId, boolean searchOptions, ChatCallback callback) {
        // 1. 读取 HomeworkServiceImpl 的历史
        List<HomeworkServiceImpl.ChatHistoryItem> historyItems = homeworkServiceImpl.getSessionHistory(sessionId);
        List<Message> history = new ArrayList<>();
        if (historyItems != null && !historyItems.isEmpty()) {
            for (HomeworkServiceImpl.ChatHistoryItem item : historyItems) {
                StringBuilder contentBuilder = new StringBuilder();
                if (item.images != null && !item.images.isEmpty()) {
                    for (String img : item.images) {
                        contentBuilder.append("[图片] ").append(img).append("\\n");
                    }
                }
                if (item.text != null) {
                    contentBuilder.append(item.text);
                }
                history.add(Message.builder()
                    .role(item.role)
                    .content(contentBuilder.toString())
                    .build());
            }
        }
        try {
            final List<Message> messages = new ArrayList<>(sessionHistory.computeIfAbsent(sessionId, k -> {
                List<Message> newHistory = new ArrayList<>();
                newHistory.add(Message.builder()
                    .role(Role.SYSTEM.getValue())
                    .content(SYSTEM_PROMPT)
                    .build());
                return newHistory;
            }));
            messages.addAll(history);
            Message userMessage = Message.builder()
                    .role(Role.USER.getValue())
                    .content(question)
                    .build();
            messages.add(userMessage);
            // 裁剪历史，保证不超tokens
            trimHistoryToFitTokens(messages, 129024);
            GenerationParam param;
            if (searchOptions) {
                logger.info("[联网搜索] searchOptions=true，开启联网查询");
                param = GenerationParam.builder()
                        .apiKey(apiKey)
                        .model("qwen-plus")
                        .messages(messages)
                        .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                        .incrementalOutput(true)
                        .temperature(0.7f)
                        .topP(0.9D)
                        .enableSearch(true) // 关键：开启联网
                        .build();
            } else {
                logger.info("[本地模式] searchOptions=false，沿用旧逻辑");
                param = createGenerationParam(messages, true);
            }
            Generation gen = new Generation();
            Flowable<GenerationResult> result = gen.streamCall(param);
            StringBuilder finalContent = new StringBuilder();
            Disposable disposable = result.subscribe(
                message -> {
                    try {
                        String content = message.getOutput().getChoices().get(0).getMessage().getContent();
                        if (!content.isEmpty()) {
                            callback.onMessage(content);
                            finalContent.append(content);
                        }
                    } catch (Exception e) {
                        logger.error("处理流式响应时出错", e);
                        callback.onError(e);
                    }
                },
                error -> {
                    logger.error("流式聊天处理出错", error);
                    callback.onError(error);
                    streamDisposables.remove(sessionId);
                },
                () -> {
                    Message assistantMessage = Message.builder()
                            .role(Role.ASSISTANT.getValue())
                            .content(finalContent.toString())
                            .build();
                    messages.add(assistantMessage);
                    sessionHistory.put(sessionId, new ArrayList<>(messages));
                    callback.onComplete();
                    streamDisposables.remove(sessionId);
                }
            );
            streamDisposables.put(sessionId, disposable);
        } catch (Exception e) {
            logger.error("流式聊天处理出错", e);
            callback.onError(e);
        }
    }

    @Override
    public void stopStream(String sessionId) {
        Disposable disposable = streamDisposables.remove(sessionId);
        if (disposable != null && !disposable.isDisposed()) {
            disposable.dispose();
            logger.info("已停止sessionId={}的流式响应", sessionId);
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

    // 新增：支持sessionId的多模态历史拼接
    public String chat(String question, String sessionId) throws NoApiKeyException, InputRequiredException {
        // 1. 读取 HomeworkServiceImpl 的历史
        List<HomeworkServiceImpl.ChatHistoryItem> historyItems = homeworkServiceImpl.getSessionHistory(sessionId);
        List<Message> history = new ArrayList<>();
        if (historyItems != null && !historyItems.isEmpty()) {
            for (HomeworkServiceImpl.ChatHistoryItem item : historyItems) {
                StringBuilder contentBuilder = new StringBuilder();
                if (item.images != null && !item.images.isEmpty()) {
                    for (String img : item.images) {
                        contentBuilder.append("[图片] ").append(img).append("\\n");
                    }
                }
                if (item.text != null) {
                    contentBuilder.append(item.text);
                }
                history.add(Message.builder()
                    .role(item.role)
                    .content(contentBuilder.toString())
                    .build());
            }
        }
        // 2. 调用标准chat
        return chat(question, history);
    }

    // 工具方法：估算消息列表的总tokens
    private int estimateTotalTokens(List<Message> messages) {
        int totalChars = 0;
        for (Message msg : messages) {
            if (msg.getContent() != null) {
                totalChars += msg.getContent().length();
            }
        }
        return totalChars / 4; // 简单估算
    }

    // 工具方法：裁剪历史，保证tokens不超限
    private void trimHistoryToFitTokens(List<Message> history, int maxTokens) {
        while (estimateTotalTokens(history) > maxTokens && !history.isEmpty()) {
            // 移除最前面的历史（通常是最早的user/assistant消息，保留system）
            if (history.size() > 1 && "system".equals(history.get(0).getRole())) {
                history.remove(1);
            } else {
                history.remove(0);
            }
        }
    }

    // 新增：将AI回复同步追加到plus主模型历史
    public void appendToPlusHistory(String sessionId, String aiReply) {
        List<Message> plusHistory = sessionHistory.computeIfAbsent(sessionId, k -> createNewHistory());
        plusHistory.add(Message.builder()
            .role(Role.ASSISTANT.getValue())
            .content(aiReply)
            .build());
    }

    @Override
    public void streamChat(String question, String sessionId, ChatCallback callback) {
        streamChat(question, sessionId, false, callback);
    }
} 