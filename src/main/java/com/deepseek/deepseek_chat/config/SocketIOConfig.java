package com.deepseek.deepseek_chat.config;

import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.SocketConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SocketIOConfig {

	@Bean
	protected SocketIOServer socketIOServer() {
		com.corundumstudio.socketio.Configuration config = new com.corundumstudio.socketio.Configuration();
		config.setHostname("0.0.0.0");
		config.setPort(8081); // 使用 8081 端口避免与 Spring Boot 冲突
		config.setOrigin("*"); // 允许所有来源
		config.setAllowCustomRequests(true);
		
		// 添加Socket配置
		SocketConfig socketConfig = new SocketConfig();
		socketConfig.setReuseAddress(true);
		socketConfig.setTcpNoDelay(true);
		socketConfig.setSoLinger(0);
		socketConfig.setTcpKeepAlive(true);
		config.setSocketConfig(socketConfig);
		
		// 设置ping超时和间隔
		config.setPingTimeout(60000);
		config.setPingInterval(25000);
		
		// 传输升级超时
		config.setUpgradeTimeout(10000);
		
		// 允许WebSocket
		config.setTransports(com.corundumstudio.socketio.Transport.WEBSOCKET);
		
		return new SocketIOServer(config);
	}
}
