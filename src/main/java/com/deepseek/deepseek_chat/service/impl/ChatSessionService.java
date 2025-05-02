package com.deepseek.deepseek_chat.service.impl;

import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.HashSet;
import lombok.Data;

/**
 * 聊天会话服务
 */
@Service
public class ChatSessionService {

    private final Map<String, List<ChatMessage>> sessions = new ConcurrentHashMap<>();
    private static final Logger logger = LoggerFactory.getLogger(ChatSessionService.class);

    /**
     * 创建新会话
     */
    public String createNewSession() {
        String sessionId = generateSessionId();
        sessions.put(sessionId, new ArrayList<>());
        // 添加欢迎消息
        addMessage(sessionId, "欢迎使用 DeepSeek Chat!", "system");
        return sessionId;
    }

    /**
     * 获取会话
     */
    public ChatSession getSession(String sessionId) {
        if (!sessions.containsKey(sessionId)) {
            logger.warn("未找到会话ID: {}", sessionId);
            return null; // 如果会话不存在，返回 null
        }
        return new ChatSession(sessionId, LocalDateTime.now());
    }

    /**
     * 删除会话
     */
    public void deleteSession(String sessionId) {
        sessions.remove(sessionId);
    }

    /**
     * 验证会话是否存在
     */
    public boolean sessionExists(String sessionId) {
        return sessions.containsKey(sessionId);
    }

    /**
     * 获取会话消息
     */
    public List<ChatMessage> getSessionMessages(String sessionId) {
        return sessions.getOrDefault(sessionId, new ArrayList<>());
    }

    /**
     * 添加消息到会话
     */
    public void addMessage(String sessionId, String content, String role) {
        List<ChatMessage> messages = sessions.computeIfAbsent(sessionId, k -> new ArrayList<>());
        messages.add(new ChatMessage(content, role, System.currentTimeMillis()));
    }

    private String generateSessionId() {
        return "s-" + System.currentTimeMillis();
    }

    /**
     * 获取所有活动会话的ID
     * @return 会话ID集合
     */
    public Set<String> getAllSessions() {
        return new HashSet<>(sessions.keySet());
    }

    /**
     * 会话类
     */
    public static class ChatSession {
        private final String id;
        private final LocalDateTime createdAt;
        private String title;
        private LocalDateTime lastActivity;

        public ChatSession(String id, LocalDateTime createdAt) {
            this.id = id;
            this.createdAt = createdAt;
            this.lastActivity = createdAt;
        }

        // Getters and setters
        public String getId() {
            return id;
        }

        public LocalDateTime getCreatedAt() {
            return createdAt;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public LocalDateTime getLastActivity() {
            return lastActivity;
        }

        public void setLastActivity(LocalDateTime lastActivity) {
            this.lastActivity = lastActivity;
        }
    }

    @Data
    public static class ChatMessage {
        private final String content;
        private final String role;
        private final long timestamp;
    }
}