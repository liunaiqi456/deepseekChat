package com.deepseek.deepseek_chat.controller;

import com.deepseek.deepseek_chat.service.ChatService;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import lombok.Data;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/chat")
public class ChatController {

    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);
    
    @Autowired
    private ChatService chatService;
    
    @Autowired
    private FileUploadController fileUploadController;
    
    // 使用ConcurrentHashMap存储会话历史
    private final Map<String, List<Message>> sessionHistory = new ConcurrentHashMap<>();
    
    // 线程池用于异步处理
    private final ExecutorService executorService = Executors.newCachedThreadPool();
    
    @PostMapping("/ask")
    public Map<String, String> chat(@RequestBody Map<String, String> request) throws NoApiKeyException, InputRequiredException {
        String question = request.get("question");
        String sessionId = request.get("sessionId");
        logger.info("收到聊天请求 - 会话ID: {}, 问题: {}", sessionId, question);
        
        // 获取或创建会话历史
        List<Message> history = sessionHistory.getOrDefault(sessionId, 
                chatService.createNewHistory());
        
        // 调用服务处理请求
        String response = chatService.chat(question, history);
        
        // 更新会话历史
        sessionHistory.put(sessionId, history);
        
        Map<String, String> responseMap = Map.of("content", response);
        return responseMap;
    }
    
    @PostMapping("/stream")
    public SseEmitter streamChat(@RequestBody ChatRequest request) {
        SseEmitter emitter = new SseEmitter(180000L); // 3分钟超时
        Boolean searchOptions = request.getSearchOptions();
        executorService.execute(() -> {
            try {
                if (Boolean.TRUE.equals(searchOptions)) {
                    // 新逻辑：开启联网查询
                    chatService.streamChat(request.getQuestion(), request.getSessionId(), true, new ChatService.ChatCallback() {
                        @Override
                        public void onMessage(String message) {
                            try {
                                ObjectMapper mapper = new ObjectMapper();
                                ObjectNode responseJson = mapper.createObjectNode();
                                responseJson.put("content", message);
                                emitter.send(SseEmitter.event()
                                    .data(mapper.writeValueAsString(responseJson))
                                    .id(String.valueOf(System.currentTimeMillis()))
                                    .name("message"));
                            } catch (Exception e) {
                                logger.error("发送消息时出错", e);
                                handleError(e);
                            }
                        }
                        @Override
                        public void onError(Throwable throwable) { handleError(throwable); }
                        @Override
                        public void onComplete() {
                            try {
                                emitter.send(SseEmitter.event().data("[DONE]").name("done"));
                                emitter.complete();
                            } catch (Exception e) { logger.error("发送完成消息时出错", e); }
                        }
                        private void handleError(Throwable throwable) {
                            try {
                                ObjectMapper mapper = new ObjectMapper();
                                ObjectNode errorJson = mapper.createObjectNode();
                                errorJson.put("error", throwable.getMessage());
                                emitter.send(SseEmitter.event().data(mapper.writeValueAsString(errorJson)).name("error"));
                                emitter.complete();
                            } catch (Exception e) { logger.error("发送错误消息时出错", e); }
                        }
                    });
                } else {
                    // 沿用旧逻辑
                    chatService.streamChat(request.getQuestion(), request.getSessionId(), new ChatService.ChatCallback() {
                        @Override
                        public void onMessage(String message) {
                            try {
                                ObjectMapper mapper = new ObjectMapper();
                                ObjectNode responseJson = mapper.createObjectNode();
                                responseJson.put("content", message);
                                emitter.send(SseEmitter.event()
                                    .data(mapper.writeValueAsString(responseJson))
                                    .id(String.valueOf(System.currentTimeMillis()))
                                    .name("message"));
                            } catch (Exception e) {
                                logger.error("发送消息时出错", e);
                                handleError(e);
                            }
                        }
                        @Override
                        public void onError(Throwable throwable) { handleError(throwable); }
                        @Override
                        public void onComplete() {
                            try {
                                emitter.send(SseEmitter.event().data("[DONE]").name("done"));
                                emitter.complete();
                            } catch (Exception e) { logger.error("发送完成消息时出错", e); }
                        }
                        private void handleError(Throwable throwable) {
                            try {
                                ObjectMapper mapper = new ObjectMapper();
                                ObjectNode errorJson = mapper.createObjectNode();
                                errorJson.put("error", throwable.getMessage());
                                emitter.send(SseEmitter.event().data(mapper.writeValueAsString(errorJson)).name("error"));
                                emitter.complete();
                            } catch (Exception e) { logger.error("发送错误消息时出错", e); }
                        }
                    });
                }
            } catch (Exception e) {
                logger.error("处理请求时出错", e);
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    ObjectNode errorJson = mapper.createObjectNode();
                    errorJson.put("error", "处理请求时出错: " + e.getMessage());
                    emitter.send(SseEmitter.event().data(mapper.writeValueAsString(errorJson)).name("error"));
                    emitter.complete();
                } catch (Exception ex) { logger.error("发送错误消息时出错", ex); }
            }
        });
        emitter.onTimeout(() -> { logger.warn("SSE连接超时"); emitter.complete(); });
        emitter.onError((ex) -> { logger.error("SSE连接出错", ex); emitter.complete(); });
        return emitter;
    }
    
    @PostMapping("/clear")
    public void clearHistory(@RequestBody Map<String, String> request) {
        String sessionId = request.get("sessionId");
        logger.info("清除会话历史 - 会话ID: {}", sessionId);
        
        // 清除会话历史
        sessionHistory.remove(sessionId);
        
        // 异步清理上传的文件
        executorService.execute(() -> {
            try {
                fileUploadController.cleanupSessionFiles(sessionId);
                logger.info("已清理会话 {} 的上传文件", sessionId);
            } catch (Exception e) {
                logger.error("清理会话 {} 的上传文件时出错", sessionId, e);
            }
        });
    }

    @PostMapping("/stop")
    public ResponseEntity<String> stopStream(@RequestBody Map<String, String> request) {
        String sessionId = request.get("sessionId");
        chatService.stopStream(sessionId);
        return ResponseEntity.ok("stopped");
    }
}

@Data
class ChatRequest {
    private String question;
    private String sessionId;
    private Boolean searchOptions;
}