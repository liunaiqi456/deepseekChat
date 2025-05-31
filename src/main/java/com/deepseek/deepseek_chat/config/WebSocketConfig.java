package com.deepseek.deepseek_chat.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.deepseek.deepseek_chat.handler.ChatWebSocketHandler;
import com.deepseek.deepseek_chat.handler.VoiceSynthesisWebSocketHandler;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler chatWebSocketHandler;
    private final VoiceSynthesisWebSocketHandler voiceSynthesisWebSocketHandler;

    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        // 注册聊天WebSocket处理器
        registry.addHandler(chatWebSocketHandler, "/socket.io/**")
               .setAllowedOrigins("http://localhost:8080")
               .setAllowedOriginPatterns("*");

        // 注册语音合成WebSocket处理器
        registry.addHandler(voiceSynthesisWebSocketHandler, "/ws/voice/**")
               .setAllowedOrigins("http://localhost:8080")
               .setAllowedOriginPatterns("*");
    }
}
