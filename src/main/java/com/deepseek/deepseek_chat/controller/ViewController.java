package com.deepseek.deepseek_chat.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import org.springframework.web.servlet.view.RedirectView;
import java.util.UUID;

@Controller
public class ViewController {
    
    @GetMapping("/")
    public RedirectView index() {
        // 生成一个新的会话ID
        String sessionId = UUID.randomUUID().toString();
        // 重定向到带会话ID的聊天页面
        return new RedirectView("/chat/s/" + sessionId);
    }
} 