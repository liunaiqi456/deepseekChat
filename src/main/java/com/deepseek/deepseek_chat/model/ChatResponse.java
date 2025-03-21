package com.deepseek.deepseek_chat.model;

public class ChatResponse {
    private String content;
    
    public ChatResponse(String content) {
        this.content = content;
    }
    
    public String getContent() {
        return content;
    }
    
    public void setContent(String content) {
        this.content = content;
    }
} 