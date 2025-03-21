package com.deepseek.deepseek_chat.config;

import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AppConfig {

    @Bean
    protected CommandLineRunner commandLineRunner(SocketIOServer socketIOServer) {
        return args -> {
            socketIOServer.start(); // 启动 Socket.IO 服务器
            System.out.println("Socket.IO server started on port 8081");
        };
    }
}
