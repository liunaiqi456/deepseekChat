package com.deepseek.deepseek_chat.config;

import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;

public class SocketIOConfig {

	public SocketIOServer socketIOServer() {
		Configuration config = new Configuration();
		config.setHostname("localhost");
		config.setPort(8081); // WebSocket 端口
		return new SocketIOServer(config);
	}
}
