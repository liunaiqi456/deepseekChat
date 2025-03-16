package com.deepseek.deepseek_chat.handler;


import com.deepseek.deepseek_chat.service.ChatService;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    private final ChatService chatService;

    public ChatWebSocketHandler(ChatService chatService) {
        this.chatService = chatService;
    }

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
        chatService.addSession(session);
        System.out.println("New connection: " + session.getId());
        session.sendMessage(new TextMessage("Welcome to the chat!"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String receivedMessage = message.getPayload();
        System.out.println("Received message: " + receivedMessage + " from " + session.getId());

        // 广播消息
        chatService.broadcastMessage("User " + session.getId() + ": " + receivedMessage);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        chatService.removeSession(session);
        System.out.println("Connection closed: " + session.getId());
    }
}
