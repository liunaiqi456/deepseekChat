package com.deepseek.deepseek_chat.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class ViewController {
    
    @GetMapping("/")
    public String index() {
        return "chat/index";  // 这里不需要加 .html，因为在配置中已经指定了后缀
    }
} 