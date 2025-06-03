package com.deepseek.deepseek_chat.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/voicechat")
public class VoiceChatController {
    
    @GetMapping
    public String voiceChat() {
        return "chat/voice-chat";  // 更新为新的模板路径
    }
}
