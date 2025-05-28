package com.deepseek.deepseek_chat.service.impl;

import com.alibaba.dashscope.aigc.multimodalconversation.MultiModalConversation;
import com.alibaba.dashscope.aigc.multimodalconversation.MultiModalConversationParam;
import com.alibaba.dashscope.aigc.multimodalconversation.MultiModalConversationResult;
import com.alibaba.dashscope.common.MultiModalMessage;
import com.alibaba.dashscope.common.Role;
import com.deepseek.deepseek_chat.service.HomeworkService;
import com.deepseek.deepseek_chat.util.HttpUtil;
import com.deepseek.deepseek_chat.model.SessionStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.JsonNode;
import io.reactivex.Flowable;
import org.apache.commons.codec.digest.DigestUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.beans.factory.annotation.Autowired;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.Serializable;
import java.io.StringWriter;
import java.io.UnsupportedEncodingException;
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
    
    @Value("${dashscope.api.key:${DASHSCOPE_API_KEY:}}")
    private String apiKey;
    
    // 讯飞OCR相关配置
    private static final String WEBOCR_URL = "http://webapi.xfyun.cn/v1/service/v1/ocr/handwriting";
    private static final String TEST_APPID = "1d49a226";
    private static final String TEST_API_KEY = "e30f49d4453d487eb429801d50a8d91d";
    
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
    
    // 统一多轮对话历史，与ChatServiceImpl共享
    private final ConcurrentHashMap<String, List<ChatHistoryItem>> sessionHistory = new ConcurrentHashMap<>();
    
    @Autowired
    @Lazy
    private ChatServiceImpl chatServiceImpl;
    
    public static class ChatHistoryItem {
        public String role; // "user" or "assistant" or "system"
        public String text; // 文本内容
        public List<String> images; // 图片路径列表
        // 可扩展更多字段
    }
    
    @Override
    public SseEmitter checkHomework(@NonNull List<MultipartFile> files, String subject, String sessionId, String customPrompt) {
        //System.out.println("【调试】checkHomework收到图片数量: " + (files == null ? 0 : files.size()));
        sessionStatusMap.put(sessionId, SessionStatus.INITIALIZING);
        SseEmitter emitter = new SseEmitter(180000L); // 3分钟超时
        
        try {
            // 自定义上传时强制重置system prompt
            if ("customs".equalsIgnoreCase(subject) && customPrompt != null && !customPrompt.trim().isEmpty()) {
                sessionHistory.remove(sessionId);
            }
            // 保存文件并获取文件路径
            List<String> filePaths = new ArrayList<>();
            for (MultipartFile file : files) {
                String path = saveHomeworkFile(file, sessionId);
                String normalizedPath = path.replace('\\', '/');
                if (!normalizedPath.startsWith("/")) {
                    normalizedPath = "/" + normalizedPath;
                }
                filePaths.add("file://" + normalizedPath);
            }
            //System.out.println("【调试】checkHomework保存图片路径: " + filePaths);
            // 获取/初始化历史
            List<ChatHistoryItem> history = sessionHistory.computeIfAbsent(sessionId, k -> new ArrayList<>());
            // systemMessage 只在历史为空时加一次
            if (history.isEmpty()) {
                ChatHistoryItem systemMessageItem = new ChatHistoryItem();
                systemMessageItem.role = Role.SYSTEM.getValue();
                if ("customs".equalsIgnoreCase(subject) && customPrompt != null && !customPrompt.trim().isEmpty()) {
                    systemMessageItem.text = customPrompt;
                } else {
                    systemMessageItem.text = SUBJECT_PROMPTS.getOrDefault(subject.toLowerCase(), "请仔细检查学生提交的作业并给出详细评价。");
                }
                //System.out.println("【调试】subject=" + subject + ", system prompt=" + systemMessageItem.text);
                history.add(systemMessageItem);
            }
            // 追加新图片消息前，移除历史中所有用户图片消息
            history.removeIf(item -> Role.USER.getValue().equals(item.role) && item.images != null && !item.images.isEmpty());
            // 构建用户消息（图片和文本）
            StringBuilder userContentBuilder = new StringBuilder();
            for (String path : filePaths) {
                userContentBuilder.append("[图片] ").append(path).append("\n");
            }
            // 仅在非自定义提示词时拼接默认说明
            if (!("customs".equalsIgnoreCase(subject) && customPrompt != null && !customPrompt.trim().isEmpty())) {
                userContentBuilder.append("请检查这些作业图片并给出详细的评价和建议。");
            }
            ChatHistoryItem userMessageItem = new ChatHistoryItem();
            userMessageItem.role = Role.USER.getValue();
            userMessageItem.text = userContentBuilder.toString();
            userMessageItem.images = new ArrayList<>(filePaths);
            history.add(userMessageItem);
            // 限制历史消息tokens总数（仅对qwen-vl-max生效）
            int MAX_TOKENS = 30720;
            while (estimateTotalTokens(history) > MAX_TOKENS && history.size() > 1) {
                // 保留system，先进先出移除最前面的非system消息
                if (history.size() > 1 && Role.SYSTEM.getValue().equals(history.get(0).role)) {
                    history.remove(1);
                } else {
                    history.remove(0);
                }
            }
            // 设置参数，带完整历史
            List<MultiModalMessage> mmHistory = new ArrayList<>();
            for (ChatHistoryItem item : history) {
                List<Map<String, Object>> content = new ArrayList<>();
                if (item.images != null) {
                    for (String img : item.images) {
                        content.add(Collections.singletonMap("image", img));
                    }
                }
                if (item.text != null && !item.text.isEmpty()) {
                    content.add(Collections.singletonMap("text", item.text));
                }
                mmHistory.add(MultiModalMessage.builder()
                    .role(item.role)
                    .content(content)
                    .build());
            }
            // 调试：打印完整prompt
            //System.out.println("【调试】即将发送给百炼的完整prompt（mmHistory/messages参数）：");
            for (int i = 0; i < mmHistory.size(); i++) {
            //    System.out.println("[" + i + "] role: " + mmHistory.get(i).getRole() + ", content: " + mmHistory.get(i).getContent());
            }
            MultiModalConversationParam param = MultiModalConversationParam.builder()
                .apiKey(apiKey)
                .model(MODEL_NAME)
                .messages(mmHistory)
                .incrementalOutput(true)
                .build();
            MultiModalConversation conversation = new MultiModalConversation();
            Flowable<MultiModalConversationResult> result = conversation.streamCall(param);
            sessionStatusMap.put(sessionId, SessionStatus.PROCESSING);
            result.subscribe(
                item -> {
                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        ObjectNode responseJson = mapper.createObjectNode();
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
                        if (messageText == null || messageText.trim().isEmpty()) {
                            logger.warn("收到空的消息文本");
                            return;
                        }
                        responseJson.put("content", messageText);
                        String jsonString = mapper.writeValueAsString(responseJson);
                        SseEmitter.SseEventBuilder eventBuilder = SseEmitter.event()
                            .data(jsonString)
                            .id(String.valueOf(System.currentTimeMillis()))
                            .name("message");
                        emitter.send(eventBuilder);
                        // AI回复追加到历史
                        ChatHistoryItem aiItem = new ChatHistoryItem();
                        aiItem.role = Role.ASSISTANT.getValue();
                        aiItem.text = messageText;
                        aiItem.images = null;
                        history.add(aiItem);
                        sessionHistory.put(sessionId, new ArrayList<>(history));
                        // 同步AI回复到plus模型历史
                        if (chatServiceImpl != null && messageText != null && !messageText.trim().isEmpty()) {
                            chatServiceImpl.appendToPlusHistory(sessionId, messageText);
                        }
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
                        emitter.complete();
                    } catch (Exception e) {
                        sessionStatusMap.put(sessionId, SessionStatus.ERROR);
                        sessionErrorMap.put(sessionId, e.getMessage());
                        logger.error("完成时出错: {}", e.getMessage(), e);
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
            
            // 错误消息
            String errorJsonString = mapper.writeValueAsString(errorJson);
            
            // 使用SseEmitter.SseEventBuilder构建错误消息
            SseEmitter.SseEventBuilder errorEventBuilder = SseEmitter.event()
                .data(errorJsonString)
                .id(String.valueOf(System.currentTimeMillis()))
                .name("error");
            
            System.out.println("=== 发送的错误消息开始 ===");
            System.out.println("使用SseEventBuilder发送: " + errorJsonString);
            System.out.println("=== 发送的错误消息结束 ===");
            
            emitter.send(errorEventBuilder);
                    
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
    // 添加变量跟踪最后一次发送的内容
    StringBuilder lastSentContent = new StringBuilder();

    @Override
    public SseEmitter ocrCheckHomework(List<MultipartFile> files, String subject, String sessionId) {
        sessionStatusMap.put(sessionId, SessionStatus.INITIALIZING);
        SseEmitter emitter = new SseEmitter(180000L); // 3分钟超时
        
        
        try {
            // 保存文件并获取文件路径
            List<String> filePaths = new ArrayList<>();
            for (MultipartFile file : files) {
                String path = saveOcrHomeworkFile(file, sessionId);
                filePaths.add(path);
            }
            
            // 使用讯飞OCR识别文本
            StringBuilder recognizedText = new StringBuilder();
            for (String filePath : filePaths) {
                try {
                    // 读取图像文件，转二进制数组，然后Base64编码
                    byte[] imageByteArray = Files.readAllBytes(Paths.get(filePath));
                    String imageBase64 = java.util.Base64.getEncoder().encodeToString(imageByteArray);
                    String bodyParam = "image=" + imageBase64;
                    
                    // 构建请求头
                    Map<String, String> header = constructHeader("en", "false");
                    
                    // 发送OCR请求
                    String result = HttpUtil.doPost(WEBOCR_URL, header, bodyParam);
                    
                    // 打印原始OCR返回结果
                    System.out.println("=== OCR原始返回结果开始 ===");
                    System.out.println(result);
                    System.out.println("=== OCR原始返回结果结束 ===");
                    
                    // 解析OCR结果
                    ObjectMapper mapper = new ObjectMapper();
                    JsonNode rootNode = mapper.readTree(result);
                    if (rootNode.has("data") && rootNode.get("data").has("block")) {
                        JsonNode blocks = rootNode.get("data").get("block");
                        for (JsonNode block : blocks) {
                            if (block.has("line")) {
                                JsonNode lines = block.get("line");
                                for (JsonNode line : lines) {
                                    if (line.has("word")) {
                                        JsonNode words = line.get("word");
                                        for (JsonNode word : words) {
                                            if (word.has("content")) {
                                                recognizedText.append(word.get("content").asText()).append(" ");
                                            }
                                        }
                                        recognizedText.append("\n");
                                    }
                                }
                            }
                        }
                    }
                    
                    // 打印处理后的OCR文本
                    System.out.println("=== OCR识别文本开始 ===");
                    System.out.println("文件路径: " + filePath);
                    System.out.println("识别内容:\n" + recognizedText.toString());
                    System.out.println("=== OCR识别文本结束 ===");
                    
                } catch (Exception e) {
                    logger.error("OCR识别失败: {}", e.getMessage(), e);
                    throw new RuntimeException("OCR识别失败: " + e.getMessage());
                }
            }
            
            // 构建系统消息
            MultiModalMessage systemMessage = MultiModalMessage.builder()
                    .role(Role.SYSTEM.getValue())
                    .content(Arrays.asList(Collections.singletonMap("text", 
                            SUBJECT_PROMPTS.getOrDefault(subject.toLowerCase(), "请仔细检查学生提交的作业并给出详细评价。"))))
                    .build();
            
            // 构建用户消息（包含识别的文本）
            List<Map<String, Object>> content = new ArrayList<>();
            content.add(Collections.singletonMap("text", "以下是作业的文字内容：\n\n" + recognizedText.toString() + "\n\n请检查这些作业内容并给出详细的评价和建议。"));
            
            MultiModalMessage userMessage = MultiModalMessage.builder()
                    .role(Role.USER.getValue())
                    .content(content)
                    .build();
            
            // 设置参数
            MultiModalConversationParam param = MultiModalConversationParam.builder()
                    .model(MODEL_NAME)
                    .apiKey(apiKey)
                    .messages(Arrays.asList(systemMessage, userMessage))
                    .build();
            
            // 创建会话实例
            MultiModalConversation conversation = new MultiModalConversation();
            
            // 发送请求并处理流式响应
            Flowable<MultiModalConversationResult> flowable = conversation.streamCall(param);
            flowable.subscribe(
                    response -> {
                        try {
                            if (response.getOutput() != null && response.getOutput().getChoices() != null &&
                                    !response.getOutput().getChoices().isEmpty()) {
                                String messageText = response.getOutput().getChoices().get(0).getMessage().getContent().get(0).get("text").toString();
                                if (messageText != null) {
                                    // 获取新增的内容
                                    String newContent = messageText;
                                    if (lastSentContent.length() > 0 && messageText.startsWith(lastSentContent.toString())) {
                                        newContent = messageText.substring(lastSentContent.length());
                                    }
                                    // 只要有新内容就整体发送（不再按字符/标点分割）
                                    if (!newContent.isEmpty()) {
                                        ObjectMapper mapper = new ObjectMapper();
                                        ObjectNode responseJson = mapper.createObjectNode();
                                        responseJson.put("content", newContent);
                                        SseEmitter.SseEventBuilder eventBuilder = SseEmitter.event()
                                            .data(mapper.writeValueAsString(responseJson))
                                            .id(String.valueOf(System.currentTimeMillis()))
                                            .name("message");
                                        emitter.send(eventBuilder);
                                    }
                                    // 更新已发送的内容
                                    lastSentContent.setLength(0);
                                    lastSentContent.append(messageText);
                                }
                            }
                        } catch (Exception e) {
                            logger.error("处理响应时出错: {}", e.getMessage(), e);
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
                            emitter.complete();
                        } catch (Exception e) {
                            sessionStatusMap.put(sessionId, SessionStatus.ERROR);
                            sessionErrorMap.put(sessionId, e.getMessage());
                            logger.error("完成时出错: {}", e.getMessage(), e);
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
    public String saveOcrHomeworkFile(MultipartFile file, String sessionId) {
        Path filePath = null;
        try {
            // 创建会话目录
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
            
            // 返回绝对路径
            return filePath.toAbsolutePath().toString();
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

    // 构建讯飞OCR请求头
    private Map<String, String> constructHeader(String language, String location) throws UnsupportedEncodingException {
        // 系统当前时间戳
        String X_CurTime = System.currentTimeMillis() / 1000L + "";
        // 业务参数
        String param = "{\"language\":\""+language+"\""+",\"location\":\"" + location + "\"}";
        String X_Param = java.util.Base64.getEncoder().encodeToString(param.getBytes("UTF-8"));
        // 生成令牌
        String X_CheckSum = DigestUtils.md5Hex(TEST_API_KEY + X_CurTime + X_Param);
        
        // 组装请求头
        Map<String, String> header = new HashMap<String, String>();
        header.put("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
        header.put("X-Param", X_Param);
        header.put("X-CurTime", X_CurTime);
        header.put("X-CheckSum", X_CheckSum);
        header.put("X-Appid", TEST_APPID);
        return header;
    }

    // 添加辅助方法
    @SuppressWarnings("unused")
	@Deprecated // 废弃：当前未被主业务流调用，后续如需使用再移除
    private boolean isPunctuationOrSpecial(char c) {
        return c == ',' || c == '.' || c == '!' || c == '?' || c == '\u3002' || c == '\u3001' || 
               c == '\uff01' || c == '\uff1f' || c == '\uff1a' || c == ':' || c == '\u201c' || c == '\u201d' || 
               c == '\u2018' || c == '\u2019' || c == '\uff08' || c == '\uff09' || c == '(' || c == ')' ||
               c == '\u3001' || c == '\uff1b' || c == ';' || c == '\u3010' || c == '\u3011' || c == '[' || 
               c == ']' || c == '/' || c == '\\' || c == '|' || c == '_' || c == '`' ||
               c == '\n' || c == '\r' || c == ' ';
    }

    // 新增：对外暴露历史获取方法，供ChatServiceImpl调用
    public List<ChatHistoryItem> getSessionHistory(String sessionId) {
        return sessionHistory.getOrDefault(sessionId, new ArrayList<>());
    }

    // 工具方法：估算历史消息的总tokens（字符数/4）
    private int estimateTotalTokens(List<ChatHistoryItem> history) {
        int totalChars = 0;
        for (ChatHistoryItem item : history) {
            if (item.text != null) {
                totalChars += item.text.length();
            }
            if (item.images != null) {
                for (String img : item.images) {
                    totalChars += img.length();
                }
            }
        }
        return totalChars / 4;
    }
} 