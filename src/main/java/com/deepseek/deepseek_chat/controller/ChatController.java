package com.deepseek.deepseek_chat.controller;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
import com.deepseek.deepseek_chat.service.DeepSeekService;
import com.deepseek.deepseek_chat.util.ResponseFormatterUtil;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/chat")
public class ChatController {
	private static final Logger logger = LoggerFactory.getLogger(ChatController.class);
	private final DeepSeekService deepSeekService;

	// 存储活跃的SSE连接
	private final Map<String, SseEmitter> emitters = new ConcurrentHashMap<>();

	public ChatController(DeepSeekService deepSeekService) {
		this.deepSeekService = deepSeekService;
	}

	//@GetMapping("/ask")
	//public String ask(@RequestParam String question) {
	//	return deepSeekService.askDeepSeek(question);
	//}

	@GetMapping("/ask")
	public ResponseEntity<String> askQuestion(@RequestParam String question) {
		 String answer = deepSeekService.askDeepSeek(question);

		    // 使用工具类格式化答案
		    String formattedAnswer = ResponseFormatterUtil.formatAnswer(answer);

		    // 使用工具类获取 UTF-8 头部
		    HttpHeaders headers = ResponseFormatterUtil.createUtf8Headers();

		    return new ResponseEntity<>(formattedAnswer, headers, HttpStatus.OK);
	}
	

	@GetMapping("/asks")
	public ResponseEntity<ResponseBodyEmitter> askQuestionStream(@RequestParam String question) {
		ResponseBodyEmitter emitter = new ResponseBodyEmitter();
		
		// 设置响应头
		HttpHeaders headers = ResponseFormatterUtil.createUtf8Headers();
		
		// 获取 AI 响应
		String answer = deepSeekService.askDeepSeek(question);
		
		// 使用工具类处理流式响应
		ResponseFormatterUtil.sendFormattedStream(emitter, answer);
		
		return ResponseEntity.ok()
				.headers(headers)
				.body(emitter);
	}

	@GetMapping(value = "/getask", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	public SseEmitter askQuestionGet(@RequestParam String question) {
		SseEmitter emitter = new SseEmitter(0L);
		String sessionId = java.util.UUID.randomUUID().toString();
		emitters.put(sessionId, emitter);

		try {
			// 发送初始消息
			emitter.send("data: {\"content\": \"正在思考...\"}\n\n");
			
			// 异步处理请求
			deepSeekService.processQuestionStream(question, emitter);
			
			// 发送完成标记
			emitter.send("data: [DONE]\n\n");
			emitter.complete();
		} catch (Exception e) {
			emitter.completeWithError(e);
		} finally {
			emitters.remove(sessionId);
		}

		return emitter;
	}

	// POST方法处理流式响应
	@PostMapping("/stream")
	public SseEmitter streamResponse(@RequestBody Map<String, String> request) {
		String question = request.get("question");
		if (question == null || question.trim().isEmpty()) {
			logger.error("问题为空");
			throw new IllegalArgumentException("问题不能为空");
		}

		String sessionId = UUID.randomUUID().toString();
		SseEmitter emitter = new SseEmitter(0L);
		emitters.put(sessionId, emitter);
		
		logger.info("收到流式请求: {}", request);
		logger.info("创建新的SSE连接，sessionId: {}", sessionId);
		
		// 发送初始消息
		try {
			emitter.send("data: {\"content\": \"正在思考...\"}\n\n");
			logger.info("发送初始消息");
		} catch (IOException e) {
			logger.error("发送初始消息失败", e);
			emitter.completeWithError(e);
			return emitter;
		}

		// 异步处理问题
		CompletableFuture.runAsync(() -> {
			try {
				logger.info("开始处理问题: {}", question);
				deepSeekService.processQuestionStream(question, emitter);
			} catch (Exception e) {
				logger.error("处理请求时发生错误", e);
				try {
					String errorMessage = e.getMessage();
					if (errorMessage.contains("Model not exist")) {
						errorMessage = "模型不存在，请检查配置";
					}
					emitter.send("data: {\"content\": \"" + errorMessage.replace("\"", "\\\"") + "\"}\n\n");
					emitter.complete();
				} catch (IOException ex) {
					emitter.completeWithError(ex);
				}
			} finally {
				// 在完成或发生错误时移除emitter
				emitters.remove(sessionId);
				logger.info("移除SSE连接，sessionId: {}", sessionId);
			}
		});

		return emitter;
	}

	// 取消SSE连接的方法
	@DeleteMapping("/cancel/{sessionId}")
	public void cancelStream(@PathVariable String sessionId) {
		SseEmitter emitter = emitters.remove(sessionId);
		if (emitter != null) {
			emitter.complete();
		}
	}
}