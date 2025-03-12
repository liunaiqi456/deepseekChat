package com.deepseek.deepseek_chat.controller;

import com.deepseek.deepseek_chat.service.DeepSeekService;

import java.nio.charset.StandardCharsets;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/chat")
public class ChatController {

	private final DeepSeekService deepSeekService;

	public ChatController(DeepSeekService deepSeekService) {
		this.deepSeekService = deepSeekService;
	}

	//@GetMapping("/ask")
	//public String ask(@RequestParam String question) {
	//	return deepSeekService.askDeepSeek(question);
	//}

	@GetMapping("/ask")
	public ResponseEntity<String> askQuestion(@RequestParam String question) {
		 // 调用 Service 获取 AI 回答
        String answer = deepSeekService.askDeepSeek(question);

        // 让句号后面换行，增强可读性
        String formattedAnswer = answer.replace(". ", ".\n\n");

        // 设置响应头，确保是 UTF-8 避免乱码
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(new MediaType("text", "plain", StandardCharsets.UTF_8));

        return new ResponseEntity<>(formattedAnswer, headers, HttpStatus.OK);
	}
	

	

}