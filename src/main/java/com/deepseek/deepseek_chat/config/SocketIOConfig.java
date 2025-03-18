package com.deepseek.deepseek_chat.config;

import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SocketIOConfig {

	@Bean
	public SocketIOServer socketIOServer() {
		com.corundumstudio.socketio.Configuration config = new com.corundumstudio.socketio.Configuration();
		config.setHostname("localhost");
		config.setPort(8081); // 使用 8081 端口避免与 Spring Boot 冲突
		config.setOrigin("*"); // 允许所有来源
		config.setAllowCustomRequests(true);
		return new SocketIOServer(config);
	}
}
