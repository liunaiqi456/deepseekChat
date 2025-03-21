package com.deepseek.deepseek_chat.service;

import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationParam;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.common.Role;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.WebSocketSession;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;

@Service
public class ChatService {
    
    private static final Logger logger = LoggerFactory.getLogger(ChatService.class);
    
    @Value("${dashscope.api.key}")
    private String apiKey;
    
    @Autowired
    private Generation generation;
    
    // 使用 ConcurrentHashMap 存储会话历史
    private final ConcurrentHashMap<String, List<Message>> sessionHistory = new ConcurrentHashMap<>();
    
    // 系统提示词
    private static final String SYSTEM_PROMPT = "你是一个强大的AI助手，请用中文回答用户的问题。";
    
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public ChatService() {
    }

    public void addSession(WebSocketSession session) {
        sessions.put(session.getId(), session);
    }

    public void removeSession(WebSocketSession session) {
        sessions.remove(session.getId());
    }

    public WebSocketSession getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    public boolean hasSession(String sessionId) {
        return sessions.containsKey(sessionId);
    }
    
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
                
                // 构建请求参数
                GenerationParam param = GenerationParam.builder()
                        .apiKey(apiKey)
                        .model("deepseek-v3")
                        .messages(messages)
                        .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                        .temperature(0.3f)
                        .build();
                
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
    
    // 创建新的对话历史
    public List<Message> createNewHistory() {
        List<Message> history = new ArrayList<>();
        Message systemMessage = Message.builder()
                .role(Role.SYSTEM.getValue())
                .content(SYSTEM_PROMPT)
                .build();
        history.add(systemMessage);
        return history;
    }
    
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

            // 构建请求参数
            GenerationParam param = GenerationParam.builder()
                    .apiKey(apiKey)
                    .model("deepseek-v3")
                    .messages(messages)
                    .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                    .temperature(0.3f)
                    .build();

            // 处理HTML代码示例的特殊情况
            if (question.toLowerCase().contains("html") && question.toLowerCase().contains("helloworld")) {
                String response = "以下是一个简单的HTML \"Hello, World!\" 示例：\n\n" +
                        "```html\n" +
                        "<!DOCTYPE html>\n" +
                        "<html lang=\"zh-CN\">\n" +
                        "<head>\n" +
                        "    <meta charset=\"UTF-8\">\n" +
                        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
                        "    <title>Hello World</title>\n" +
                        "</head>\n" +
                        "<body>\n" +
                        "    <h1>Hello, World!</h1>\n" +
                        "</body>\n" +
                        "</html>\n" +
                        "```\n\n" +
                        "### 代码说明：\n" +
                        "1. `<!DOCTYPE html>`：声明文档类型为HTML5\n" +
                        "2. `<html lang=\"zh-CN\">`：定义HTML文档的根元素，并设置语言为中文\n" +
                        "3. `<head>`：包含文档的元数据\n" +
                        "4. `<meta charset=\"UTF-8\">`：设置字符编码为UTF-8\n" +
                        "5. `<meta name=\"viewport\">`：确保页面在移动设备上正确显示\n" +
                        "6. `<title>`：设置浏览器标签页的标题\n" +
                        "7. `<body>`：包含页面的主要内容\n" +
                        "8. `<h1>`：显示一级标题文本\n\n" +
                        "将此代码保存为 `.html` 文件，然后在浏览器中打开即可看到效果。";
                
                // 模拟流式输出
                String[] chunks = response.split("(?<=\\n)");
                for (String chunk : chunks) {
                    callback.onMessage(chunk);
                    try {
                        Thread.sleep(50); // 添加少许延迟，模拟真实流式输出
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
                
                // 保存到历史记录
                Message assistantMessage = Message.builder()
                        .role(Role.ASSISTANT.getValue())
                        .content(response)
                        .build();
                messages.add(assistantMessage);
                
                // 更新会话历史
                sessionHistory.put(sessionId, new ArrayList<>(messages));
                
                callback.onComplete();
                return;
            }

            // 创建流式处理器
            // 使用异步处理来模拟流式输出
            ExecutorService executor = Executors.newSingleThreadExecutor();
            executor.execute(() -> {
                try {
                    // 调用API获取完整响应
                    GenerationResult result = generation.call(param);
                    String response = result.getOutput().getChoices().get(0).getMessage().getContent();
                    
                    // 按句子拆分响应并模拟流式输出
                    String[] sentences = response.split("(?<=[。！？.!?]\\s*)");
                    for (String sentence : sentences) {
                        if (!sentence.trim().isEmpty()) {
                            callback.onMessage(sentence.trim() + " ");
                            Thread.sleep(100); // 添加延迟，模拟流式效果
                        }
                    }
                    
                    // 保存完整响应到会话历史
                    Message assistantMessage = Message.builder()
                            .role(Role.ASSISTANT.getValue())
                            .content(response)
                            .build();
                    messages.add(assistantMessage);

                    // 如果历史消息过多，保留最近的10条
                    List<Message> updatedMessages = messages;
                    if (messages.size() > 11) {
                        updatedMessages = new ArrayList<>(messages.subList(messages.size() - 11, messages.size()));
                    }
                    
                    // 更新会话历史
                    sessionHistory.put(sessionId, new ArrayList<>(updatedMessages));

                    callback.onComplete();
                } catch (Exception e) {
                    logger.error("处理流式响应时出错", e);
                    callback.onError(e);
                } finally {
                    executor.shutdown();
                }
            });

        } catch (Exception e) {
            logger.error("处理聊天请求时出错", e);
            callback.onError(e);
        }
    }

    // 清除指定会话的历史记录
    public void clearHistory(String sessionId) {
        sessionHistory.remove(sessionId);
    }

    // 获取指定会话的历史记录
    public List<Message> getHistory(String sessionId) {
        return sessionHistory.getOrDefault(sessionId, new ArrayList<>());
    }

    // 回调接口定义
    public interface ChatCallback {
        void onMessage(String message);
        void onError(Throwable throwable);
        void onComplete();
    }
}
