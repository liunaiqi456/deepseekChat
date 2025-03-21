package com.deepseek.deepseek_chat.model;

public class Message {
    private String content;
    private String sender;
    private long timestamp;

    public Message(String content, String sender) {
        this.content = content;
        this.sender = sender;
        this.timestamp = System.currentTimeMillis();
    }

    // Getters and Setters
    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}