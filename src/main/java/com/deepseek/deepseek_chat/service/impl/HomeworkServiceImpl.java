package com.deepseek.deepseek_chat.service.impl;

import com.alibaba.dashscope.aigc.multimodalconversation.MultiModalConversation;
import com.alibaba.dashscope.aigc.multimodalconversation.MultiModalConversationParam;
import com.alibaba.dashscope.aigc.multimodalconversation.MultiModalConversationResult;
import com.alibaba.dashscope.common.MultiModalMessage;
import com.alibaba.dashscope.common.Role;
import com.deepseek.deepseek_chat.service.HomeworkService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.reactivex.Flowable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.Serializable;
import java.io.StringWriter;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import com.alibaba.dashscope.exception.ApiException;
import java.nio.file.FileSystemException;
import java.util.concurrent.TimeoutException;

@Service
public class HomeworkServiceImpl implements HomeworkService, Serializable {
    
    private static final long serialVersionUID = 1L;
    
    private static final Logger logger = LoggerFactory.getLogger(HomeworkServiceImpl.class);
    
    @Value("${file.upload-dir:${user.home}/deepseek/uploads}")
    private String uploadDir;
    
    @Value("${dashscope.api.key}")
    private String apiKey;
    
    private static final String MODEL_NAME = "qwen-vl-max";
    
    private static final Map<String, String> SUBJECT_PROMPTS = new HashMap<String, String>() {/**
		 * 
		 */
		private static final long serialVersionUID = 1L;

	{
        put("chinese", "你现在是一位经验丰富的语文老师。请仔细查看学生提交的作业图片，详细分析作文或题目的答案。给出具体的修改建议和评分。评价要点包括：\n" +
                "1. 内容是否准确、完整\n" +
                "2. 文字表达是否通顺、规范\n" +
                "3. 错别字、标点符号使用\n" +
                "4. 作文结构和段落安排\n" +
                "请以鼓励性的语气点评，并给出改进建议。");
        
        put("math", "你现在是一位经验丰富的数学老师。请仔细检查学生提交的数学作业图片，详细分析解题过程和答案。评价要点包括：\n" +
                "1. 解题思路是否清晰\n" +
                "2. 计算过程是否准确\n" +
                "3. 答案是否正确\n" +
                "4. 格式书写是否规范\n" +
                "对错误之处要详细说明原因，并给出正确的解题方法。数学题要分步骤解答，输出对这道题的思考判断过程。");
        
        put("english", "你现在是一位经验丰富的英语老师。请仔细检查学生提交的英语作业图片，详细分析答案。评价要点包括：\n" +
                "1. 语法使用是否正确\n" +
                "2. 单词拼写是否准确\n" +
                "3. 句子结构是否合理\n" +
                "4. 作文内容和逻辑性\n" +
                "请指出错误并给出详细的修改建议，同时肯定学生的进步。");
    }};
    
    // 添加会话状态枚举
    private enum SessionStatus {
        INITIALIZING,
        PROCESSING,
        COMPLETED,
        ERROR
    }
    
    // 添加会话状态跟踪
    private final Map<String, SessionStatus> sessionStatusMap = new ConcurrentHashMap<>();
    private final Map<String, String> sessionErrorMap = new ConcurrentHashMap<>();
    
    // 添加错误类型枚举
    private enum ErrorType {
        NETWORK_ERROR("网络错误"),
        FILE_ERROR("文件处理错误"),
        API_ERROR("API调用错误"),
        TIMEOUT_ERROR("超时错误"),
        UNKNOWN_ERROR("未知错误");

        private final String description;

        ErrorType(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }
    
    @Override
    public SseEmitter checkHomework(List<MultipartFile> files, String subject, String sessionId) {
        sessionStatusMap.put(sessionId, SessionStatus.INITIALIZING);
        SseEmitter emitter = new SseEmitter(180000L); // 3分钟超时
        
        try {
            // 保存文件并获取文件路径
            List<String> filePaths = new ArrayList<>();
            for (MultipartFile file : files) {
                String path = saveHomeworkFile(file, sessionId);
                // 转换路径分隔符并确保正确的file://格式
                String normalizedPath = path.replace('\\', '/');
                if (!normalizedPath.startsWith("/")) {
                    normalizedPath = "/" + normalizedPath;
                }
                filePaths.add("file://" + normalizedPath);
            }
            
            // 构建系统消息
            MultiModalMessage systemMessage = MultiModalMessage.builder()
                    .role(Role.SYSTEM.getValue())
                    .content(Arrays.asList(Collections.singletonMap("text", 
                            SUBJECT_PROMPTS.getOrDefault(subject.toLowerCase(), "请仔细检查学生提交的作业并给出详细评价。"))))
                    .build();
            
            // 构建用户消息（包含图片）
            List<Map<String, Object>> content = new ArrayList<>();
            for (String path : filePaths) {
                content.add(Collections.singletonMap("image", path));
            }
            content.add(Collections.singletonMap("text", "请检查这些作业图片并给出详细的评价和建议。"));
            
            MultiModalMessage userMessage = MultiModalMessage.builder()
                    .role(Role.USER.getValue())
                    .content(content)
                    .build();
            
            // 设置参数
            MultiModalConversationParam param = MultiModalConversationParam.builder()
                    .apiKey(apiKey)
                    .model(MODEL_NAME)
                    .messages(Arrays.asList(systemMessage, userMessage))
                    .incrementalOutput(true)
                    .build();
            
            // 创建会话实例
            MultiModalConversation conversation = new MultiModalConversation();
            
            // 流式调用
            Flowable<MultiModalConversationResult> result = conversation.streamCall(param);
            
            // 用于累积消息内容
            StringBuilder accumulatedContent = new StringBuilder();
            
            // 更新会话状态
            sessionStatusMap.put(sessionId, SessionStatus.PROCESSING);
            
            result.subscribe(
                    item -> {
                        try {
                            // 创建JSON响应
                            ObjectMapper mapper = new ObjectMapper();
                            ObjectNode responseJson = mapper.createObjectNode();
                            
                            // 添加空值检查
                            if (item == null || item.getOutput() == null || 
                                item.getOutput().getChoices() == null || 
                                item.getOutput().getChoices().isEmpty() ||
                                item.getOutput().getChoices().get(0).getMessage() == null ||
                                item.getOutput().getChoices().get(0).getMessage().getContent() == null ||
                                item.getOutput().getChoices().get(0).getMessage().getContent().isEmpty()) {
                                logger.warn("收到空的响应数据");
                                return;
                            }
                            
                            String messageText = item.getOutput().getChoices().get(0).getMessage().getContent().get(0).get("text").toString();
                            
                            // 检查消息文本是否为空
                            if (messageText == null || messageText.trim().isEmpty()) {
                                logger.warn("收到空的消息文本");
                                return;
                            }
                            
                            // 累加新内容
                            accumulatedContent.append(messageText);
                            
                            // 发送完整的累积内容，确保内容不为null
                            String currentContent = accumulatedContent.toString();
                            responseJson.put("content", currentContent != null ? currentContent : "");
                            responseJson.put("type", "message"); // 添加消息类型
                            
                            // 发送SSE事件
                            emitter.send(SseEmitter.event()
                                    .data(mapper.writeValueAsString(responseJson))
                                    .id(String.valueOf(System.currentTimeMillis()))
                                    .name("message"));
                            
                        } catch (Exception e) {
                            sessionStatusMap.put(sessionId, SessionStatus.ERROR);
                            sessionErrorMap.put(sessionId, e.getMessage());
                            logger.error("发送消息时出错: {}", e.getMessage(), e);
                            handleError(emitter, e);
                        }
                    },
                    error -> {
                        sessionStatusMap.put(sessionId, SessionStatus.ERROR);
                        sessionErrorMap.put(sessionId, error.getMessage());
                        logger.error("流处理出错: {}", error.getMessage(), error);
                        handleError(emitter, error);
                    },
                    () -> {
                        try {
                            sessionStatusMap.put(sessionId, SessionStatus.COMPLETED);
                            // 创建完成消息的JSON格式
                            ObjectMapper mapper = new ObjectMapper();
                            ObjectNode doneJson = mapper.createObjectNode();
                            doneJson.put("type", "done");
                            doneJson.put("content", ""); // 确保content字段存在且不为null
                            
                            emitter.send(SseEmitter.event()
                                    .data(mapper.writeValueAsString(doneJson))
                                    .id(String.valueOf(System.currentTimeMillis()))
                                    .name("done"));
                            emitter.complete();
                        } catch (Exception e) {
                            sessionStatusMap.put(sessionId, SessionStatus.ERROR);
                            sessionErrorMap.put(sessionId, e.getMessage());
                            logger.error("发送完成消息时出错: {}", e.getMessage(), e);
                            handleError(emitter, e);
                        }
                    }
            );
            
        } catch (Exception e) {
            sessionStatusMap.put(sessionId, SessionStatus.ERROR);
            sessionErrorMap.put(sessionId, e.getMessage());
            logger.error("处理作业检查请求时出错", e);
            handleError(emitter, e);
        }
        
        return emitter;
    }
    
    @Override
    public String saveHomeworkFile(MultipartFile file, String sessionId) {
        Path filePath = null;
        try {
            // 创建会话目录，使用正斜杠
            String sessionDir = uploadDir + "/" + sessionId + "/homework";
            Path uploadPath = Paths.get(sessionDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            
            // 生成唯一文件名
            String originalFilename = file.getOriginalFilename();
            String fileExtension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String uniqueFilename = UUID.randomUUID().toString() + fileExtension;
            
            // 保存文件
            filePath = uploadPath.resolve(uniqueFilename);
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, filePath);
            }
            
            // 返回规范化的绝对路径
            return filePath.toAbsolutePath().toString().replace('\\', '/');
        } catch (IOException e) {
            // 如果保存失败，尝试删除已创建的文件
            if (filePath != null) {
                try {
                    Files.deleteIfExists(filePath);
                } catch (IOException deleteError) {
                    logger.warn("清理失败的上传文件时出错", deleteError);
                }
            }
            logger.error("保存作业文件时出错: {}", e.getMessage(), e);
            throw new RuntimeException("文件保存失败: " + e.getMessage());
        }
    }
    
    private void handleError(SseEmitter emitter, Throwable throwable) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            ObjectNode errorJson = mapper.createObjectNode();
            
            // 确定错误类型
            ErrorType errorType = determineErrorType(throwable);
            
            // 构建详细的错误信息
            errorJson.put("error", throwable.getMessage());
            errorJson.put("errorType", errorType.name());
            errorJson.put("errorDescription", errorType.getDescription());
            errorJson.put("timestamp", System.currentTimeMillis());
            
            // 添加堆栈跟踪（仅在开发环境）
            if (isDevelopmentEnvironment()) {
                StringWriter sw = new StringWriter();
                throwable.printStackTrace(new PrintWriter(sw));
                errorJson.put("stackTrace", sw.toString());
            }
            
            // 发送错误事件
            emitter.send(SseEmitter.event()
                    .data(mapper.writeValueAsString(errorJson))
                    .name("error"));
                    
            // 记录详细日志
            logger.error("错误类型: {}, 描述: {}, 详细信息: {}", 
                    errorType.name(), 
                    errorType.getDescription(), 
                    throwable.getMessage(), 
                    throwable);
                    
        } catch (Exception e) {
            logger.error("处理错误消息时发生异常", e);
        } finally {
            emitter.complete();
        }
    }
    
    private ErrorType determineErrorType(Throwable throwable) {
        if (throwable instanceof IOException) {
            return ErrorType.NETWORK_ERROR;
        } else if (throwable instanceof ApiException) {
            return ErrorType.API_ERROR;
        } else if (throwable instanceof TimeoutException) {
            return ErrorType.TIMEOUT_ERROR;
        } else if (throwable instanceof FileSystemException) {
            return ErrorType.FILE_ERROR;
        } else {
            return ErrorType.UNKNOWN_ERROR;
        }
    }
    
    private boolean isDevelopmentEnvironment() {
        // 根据实际配置判断是否为开发环境
        return Arrays.asList("dev", "local").contains(
            System.getProperty("spring.profiles.active", "dev")
        );
    }
    
    // 添加获取会话状态的方法
    public SessionStatus getSessionStatus(String sessionId) {
        return sessionStatusMap.getOrDefault(sessionId, SessionStatus.ERROR);
    }
    
    // 添加获取会话错误信息的方法
    public String getSessionError(String sessionId) {
        return sessionErrorMap.get(sessionId);
    }
    
    // 添加清理会话状态的方法
    public void clearSessionStatus(String sessionId) {
        sessionStatusMap.remove(sessionId);
        sessionErrorMap.remove(sessionId);
    }
} 