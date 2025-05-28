package com.deepseek.deepseek_chat.service;

import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.deepseek.deepseek_chat.model.SessionStatus;
import org.springframework.lang.NonNull;

import java.util.List;

public interface HomeworkService {
    /**
     * 检查作业（基础版）
     * @param files 作业图片文件列表
     * @param subject 科目
     * @param sessionId 会话ID
     * @param customPrompt 自定义提示
     * @return SSE发射器用于流式输出
     */
    SseEmitter checkHomework(@NonNull List<MultipartFile> files, String subject, String sessionId, String customPrompt);
    
    /**
     * 保存作业文件（基础版）
     * @param file 文件
     * @param sessionId 会话ID
     * @return 文件路径
     */
    String saveHomeworkFile(MultipartFile file, String sessionId);

    /**
     * 使用OCR检查作业（高级版）
     * @param files 作业图片文件列表
     * @param subject 科目
     * @param sessionId 会话ID
     * @return SSE发射器用于流式输出
     */
    SseEmitter ocrCheckHomework(List<MultipartFile> files, String subject, String sessionId);
    
    /**
     * 保存OCR作业文件（高级版）
     * @param file 文件
     * @param sessionId 会话ID
     * @return 文件路径
     */
    String saveOcrHomeworkFile(MultipartFile file, String sessionId);

    /**
     * 获取会话状态
     * @param sessionId 会话ID
     * @return 会话状态
     */
    SessionStatus getSessionStatus(String sessionId);
    
    /**
     * 获取会话错误信息
     * @param sessionId 会话ID
     * @return 会话错误信息
     */
    String getSessionError(String sessionId);
    
    /**
     * 清理会话状态
     * @param sessionId 会话ID
     */
    void clearSessionStatus(String sessionId);
} 