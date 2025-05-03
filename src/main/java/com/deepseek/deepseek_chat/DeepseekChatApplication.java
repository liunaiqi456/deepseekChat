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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
@Import(SocketIOConfig.class)
public class DeepseekChatApplication {

	private final Map<String, List<Message>> sessionHistory = new ConcurrentHashMap<>();

	@Value("${file.upload-dir:${user.home}/deepseek/uploads}")
	private String uploadDir;

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

	/**
	 * 应用启动时初始化上传目录
	 */
	@Bean
	public CommandLineRunner initializeUploadDirectory() {
		return args -> {
			try {
				Path uploadPath = Paths.get(uploadDir);
				if (!Files.exists(uploadPath)) {
					Files.createDirectories(uploadPath);
					System.out.println("上传目录已创建: " + uploadPath.toAbsolutePath());
				} else {
					System.out.println("上传目录已存在: " + uploadPath.toAbsolutePath());
				}
				
				// 确保目录具有读写权限
				File dirFile = uploadPath.toFile();
				if (!dirFile.canRead() || !dirFile.canWrite()) {
					System.out.println("警告: 上传目录可能没有足够的读写权限");
				}
			} catch (Exception e) {
				System.err.println("初始化上传目录失败: " + e.getMessage());
				e.printStackTrace();
			}
		};
	}
}
