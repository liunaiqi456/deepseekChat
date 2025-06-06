package com.deepseek.deepseek_chat.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import lombok.extern.slf4j.Slf4j;

/**
 * 语音识别控制器
 */
@Slf4j
@Controller
@RequestMapping("/voice")
public class VoiceRecognitionController {

    /**
     * 访问语音识别页面
     * @return 语音识别页面模板
     */
    @GetMapping("/chat")
    public String voiceRecognitionPage() {
        log.info("访问语音识别页面");
        return "chat/v-chat";
    }
}
