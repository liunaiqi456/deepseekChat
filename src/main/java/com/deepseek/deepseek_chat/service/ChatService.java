package com.deepseek.deepseek_chat.service;

import com.alibaba.dashscope.common.Message;
import com.alibaba.dashscope.exception.InputRequiredException;
import com.alibaba.dashscope.exception.NoApiKeyException;
import org.springframework.web.socket.WebSocketSession;
import java.util.List;

public interface ChatService {
    void addSession(WebSocketSession session);
    void removeSession(WebSocketSession session);
    WebSocketSession getSession(String sessionId);
    boolean hasSession(String sessionId);
    String chat(String question, List<Message> history) throws NoApiKeyException, InputRequiredException;
    List<Message> createNewHistory();
    void streamChat(String question, String sessionId, ChatCallback callback);
    void clearHistory(String sessionId);
    List<Message> getHistory(String sessionId);
    void stopStream(String sessionId);

    // 回调接口定义
    interface ChatCallback {
        void onMessage(String message);
        void onError(Throwable throwable);
        void onComplete();
    }
}
