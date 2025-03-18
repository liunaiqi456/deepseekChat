package com.deepseek.deepseek_chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;
import com.deepseek.deepseek_chat.config.SocketIOConfig;

@SpringBootApplication
@Import(SocketIOConfig.class)
public class DeepseekChatApplication {

	public static void main(String[] args) {
		SpringApplication.run(DeepseekChatApplication.class, args);
	}

	 @Bean
	    public SocketIOServer socketIOServer() {
	        Configuration config = new Configuration();
	        config.setHostname("localhost");
	        config.setPort(8081); // WebSocket 端口
	        return new SocketIOServer(config);
	    }
	 

}
