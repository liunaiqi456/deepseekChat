package com.deepseek.deepseek_chat.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class SessionController {

    @GetMapping("/chat/s/{sessionId}")
    public String getSession(@PathVariable String sessionId) {
        // 这里可以添加会话验证逻辑
        return "chat/index"; // 返回主聊天页面
    }
} 