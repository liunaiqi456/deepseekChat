package com.deepseek.deepseek_chat.service;

import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

public interface HomeworkService {
    /**
     * 批改作业并返回结果
     * @param files 作业图片文件列表
     * @param subject 科目
     * @param sessionId 会话ID
     * @return SSE发射器用于流式输出
     */
    SseEmitter checkHomework(List<MultipartFile> files, String subject, String sessionId);
    
    /**
     * 保存作业文件
     * @param file 文件
     * @param sessionId 会话ID
     * @return 文件路径
     */
    String saveHomeworkFile(MultipartFile file, String sessionId);
} 