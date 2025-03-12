package com.deepseek.deepseek_chat.service;

import org.springframework.stereotype.Service;

@Service
public class ChatService {
    
    // 在这里添加处理业务的代码，比如调用外部 API
    public String getChatResponse(String userInput) {
        // 假设我们需要调用某个AI服务或其他功能来生成对话的回复
        return "AI Response for: " + userInput;
    }
}