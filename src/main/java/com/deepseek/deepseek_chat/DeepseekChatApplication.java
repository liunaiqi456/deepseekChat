package com.deepseek.deepseek_chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
import com.deepseek.deepseek_chat.config.SocketIOConfig;

@SpringBootApplication
@Import(SocketIOConfig.class)
public class DeepseekChatApplication {

	public static void main(String[] args) {
		SpringApplication.run(DeepseekChatApplication.class, args);
	}
}
