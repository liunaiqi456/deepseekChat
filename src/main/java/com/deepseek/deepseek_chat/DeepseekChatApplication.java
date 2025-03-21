package com.deepseek.deepseek_chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
import com.deepseek.deepseek_chat.model.Message;
import com.deepseek.deepseek_chat.config.SocketIOConfig;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.concurrent.ConcurrentHashMap;

@SpringBootApplication
@Import(SocketIOConfig.class)
public class DeepseekChatApplication {

	private final Map<String, List<Message>> sessionHistory = new ConcurrentHashMap<>();

	public static void main(String[] args) {
		SpringApplication.run(DeepseekChatApplication.class, args);
	}

	public void addSession(String sessionId) {
		if (!sessionHistory.containsKey(sessionId)) {
			List<Message> history = createNewHistory();
			sessionHistory.put(sessionId, history);
		}
	}

	private List<Message> createNewHistory() {
		return new ArrayList<>();
	}

	public List<Message> getSessionHistory(String sessionId) {
		return sessionHistory.get(sessionId);
	}

	public boolean hasSession(String sessionId) {
		return sessionHistory.containsKey(sessionId);
	}
}
