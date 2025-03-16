package com.deepseek.deepseek_chat.controller;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

import com.deepseek.deepseek_chat.service.DeepSeekService;
import com.deepseek.deepseek_chat.util.ResponseFormatterUtil;


import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

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

	

}