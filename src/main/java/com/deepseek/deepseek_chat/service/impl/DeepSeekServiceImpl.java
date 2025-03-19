package com.deepseek.deepseek_chat.service.impl;

import com.alibaba.dashscope.aigc.generation.Generation;
import com.alibaba.dashscope.aigc.generation.GenerationParam;
import com.alibaba.dashscope.aigc.generation.GenerationResult;
import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.common.Role;
import com.alibaba.dashscope.common.ResultCallback;
import com.alibaba.dashscope.exception.ApiException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.deepseek.deepseek_chat.service.DeepSeekService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.apache.commons.text.StringEscapeUtils;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class DeepSeekServiceImpl implements DeepSeekService {

    @Autowired
    private Generation generation;

    @Value("${dashscope.api.key}")
    private String apiKey;

    private String escapeContent(String content) {
        if (content == null) {
            return "";
        }

        // 首先处理HTML实体
        String escaped = content
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;")
                .replace("/", "&#47;");

        // 处理JSON特殊字符
        escaped = escaped
                .replace("\\", "\\\\")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\"", "\\\"");

        // 处理其他特殊字符
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < escaped.length(); i++) {
            char c = escaped.charAt(i);
            if (c < 32 || c > 126) {
                result.append(String.format("\\u%04x", (int) c));
            } else {
                result.append(c);
            }
        }
        return result.toString();
    }

    @Override
    public String processQuestion(String question) {
        try {
            // 构建消息
            List<Message> messages = new ArrayList<>();
            messages.add(Message.builder()
                    .role(Role.USER.getValue())
                    .content(question)
                    .build());

            // 构建参数
            GenerationParam param = GenerationParam.builder()
                    .apiKey(apiKey)
                    .model("deepseek-v3")
                    .messages(messages)
                    .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                    .build();

            // 发送请求
            GenerationResult result = generation.call(param);
            
            // 处理响应
            if (result.getOutput() != null && result.getOutput().getChoices() != null && !result.getOutput().getChoices().isEmpty()) {
                return result.getOutput().getChoices().get(0).getMessage().getContent();
            }
            return "无法获取响应";
        } catch (ApiException | NoApiKeyException | InputRequiredException e) {
            return "API调用错误: " + e.getMessage();
        } catch (Exception e) {
            return "处理请求时发生错误: " + e.getMessage();
        }
    }

    @Override
    public void processQuestionStream(String question, SseEmitter emitter) {
        // 使用AtomicBoolean来跟踪emitter状态
        AtomicBoolean isCompleted = new AtomicBoolean(false);
        
        // 添加完成回调
        emitter.onCompletion(() -> isCompleted.set(true));
        emitter.onTimeout(() -> {
            isCompleted.set(true);
            emitter.complete();
        });
        emitter.onError(e -> {
            isCompleted.set(true);
            emitter.completeWithError(e);
        });

        CompletableFuture.runAsync(() -> {
            try {
                // 构建消息
                List<Message> messages = new ArrayList<>();
                messages.add(Message.builder()
                        .role(Role.USER.getValue())
                        .content(question)
                        .build());

                // 构建参数
                GenerationParam param = GenerationParam.builder()
                        .apiKey(apiKey)
                        .model("deepseek-v3")
                        .messages(messages)
                        .resultFormat(GenerationParam.ResultFormat.MESSAGE)
                        .build();

                // 发送流式请求
                generation.streamCall(param, new ResultCallback<GenerationResult>() {
                    @Override
                    public void onEvent(GenerationResult response) {
                        if (isCompleted.get()) return;
                        try {
                            if (response.getOutput() != null && response.getOutput().getChoices() != null && !response.getOutput().getChoices().isEmpty()) {
                                String content = response.getOutput().getChoices().get(0).getMessage().getContent();
                                String escapedContent = escapeContent(content);
                                emitter.send("data: {\"content\": \"" + escapedContent + "\"}\n\n");
                            }
                        } catch (IOException e) {
                            if (!isCompleted.get()) {
                                emitter.completeWithError(e);
                            }
                        }
                    }

                    @Override
                    public void onError(Exception e) {
                        if (isCompleted.get()) return;
                        try {
                            String errorMessage = e.getMessage();
                            if (errorMessage.contains("Model not exist")) {
                                errorMessage = "模型不存在，请检查配置";
                            } else if (errorMessage.contains("No API key")) {
                                errorMessage = "API密钥未配置，请检查配置";
                            }
                            // 处理JSON格式的错误消息
                            if (errorMessage.startsWith("{")) {
                                errorMessage = errorMessage.replace("\"", "\\\"");
                            }
                            emitter.send("data: {\"content\": \"" + errorMessage + "\"}\n\n");
                            emitter.complete();
                        } catch (IOException ex) {
                            if (!isCompleted.get()) {
                                emitter.completeWithError(ex);
                            }
                        }
                    }

                    @Override
                    public void onComplete() {
                        if (isCompleted.get()) return;
                        try {
                            emitter.send("data: [DONE]\n\n");
                            emitter.complete();
                        } catch (IOException e) {
                            if (!isCompleted.get()) {
                                emitter.completeWithError(e);
                            }
                        }
                    }
                });
            } catch (Exception e) {
                if (!isCompleted.get()) {
                    try {
                        String errorMessage = e.getMessage();
                        if (errorMessage.contains("Model not exist")) {
                            errorMessage = "模型不存在，请检查配置";
                        } else if (errorMessage.contains("No API key")) {
                            errorMessage = "API密钥未配置，请检查配置";
                        }
                        emitter.send("data: {\"content\": \"" + errorMessage + "\"}\n\n");
                        emitter.complete();
                    } catch (IOException ex) {
                        emitter.completeWithError(ex);
                    }
                }
            }
        });
    }
} 