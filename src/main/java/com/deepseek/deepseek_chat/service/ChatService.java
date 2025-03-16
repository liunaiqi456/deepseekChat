package com.deepseek.deepseek_chat.service;

import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

@Service
public class ChatService {

    private final List<WebSocketSession> sessions = new ArrayList<>();

    /**
     * 添加会话
     */
    public void addSession(WebSocketSession session) {
        sessions.add(session);
    }

    /**
     * 移除会话
     */
    public void removeSession(WebSocketSession session) {
        sessions.remove(session);
    }

    /**
     * 广播消息
     */
    public void broadcastMessage(String message) throws IOException {
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(message));
            }
        }
    }
}
