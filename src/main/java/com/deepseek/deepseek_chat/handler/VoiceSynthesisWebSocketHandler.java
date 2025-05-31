package com.deepseek.deepseek_chat.handler;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import com.alibaba.nls.client.protocol.NlsClient;
import com.alibaba.nls.client.protocol.OutputFormatEnum;
import com.alibaba.nls.client.protocol.SampleRateEnum;
import com.alibaba.nls.client.protocol.tts.SpeechSynthesizer;
import com.alibaba.nls.client.protocol.tts.SpeechSynthesizerListener;
import com.alibaba.nls.client.protocol.tts.SpeechSynthesizerResponse;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * WebSocket处理器，用于实时语音合成
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VoiceSynthesisWebSocketHandler extends AbstractWebSocketHandler {

    @Value("${aliyun.nls.appkey:${NLS_APP_KEY:}}")
    private String appKey;

    private final NlsClient nlsClient;
    private final Map<String, SpeechSynthesizer> synthesizerMap = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(@NonNull WebSocketSession session) {
        log.info("WebSocket连接已建立: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, @NonNull TextMessage message) {
        try {
            String text = message.getPayload();
            log.info("收到文本消息: {}", text);

            // 创建语音合成实例
            SpeechSynthesizer synthesizer = new SpeechSynthesizer(nlsClient, createListener(session));
            synthesizerMap.put(session.getId(), synthesizer);

            // 设置语音合成参数
            synthesizer.setAppKey(appKey);
            synthesizer.setFormat(OutputFormatEnum.WAV);
            synthesizer.setSampleRate(SampleRateEnum.SAMPLE_RATE_16K);
            synthesizer.setVoice("siyue");
            synthesizer.setVolume(50);
            synthesizer.setSpeechRate(0);
            synthesizer.setPitchRate(0);
            synthesizer.setText(text);

            // 开始语音合成
            synthesizer.start();
        } catch (Exception e) {
            log.error("处理WebSocket消息时发生错误", e);
            try {
                session.close(CloseStatus.SERVER_ERROR);
            } catch (IOException ex) {
                log.error("关闭WebSocket连接时发生错误", ex);
            }
        }
    }

    @Override
    public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) {
        log.info("WebSocket连接已关闭: {}, 状态: {}", session.getId(), status);
        // 清理资源
        SpeechSynthesizer synthesizer = synthesizerMap.remove(session.getId());
        if (synthesizer != null) {
            synthesizer.close();
        }
    }

    /**
     * 创建语音合成监听器
     */
    private SpeechSynthesizerListener createListener(WebSocketSession session) {
        return new SpeechSynthesizerListener() {
            private boolean firstChunk = true;

            @Override
            public void onMessage(ByteBuffer message) {
                try {
                    if (firstChunk) {
                        firstChunk = false;
                        log.info("收到第一包语音数据");
                    }
                    // 发送音频数据
                    byte[] audioData = new byte[message.remaining()];
                    message.get(audioData);
                    session.sendMessage(new BinaryMessage(audioData));
                } catch (IOException e) {
                    log.error("发送音频数据时发生错误", e);
                }
            }

            @Override
            public void onComplete(SpeechSynthesizerResponse response) {
                log.info("语音合成完成: {}", response.getStatus());
                try {
                    // 发送完成消息
                    session.sendMessage(new TextMessage("{\"type\":\"complete\"}"));
                } catch (IOException e) {
                    log.error("发送完成消息时发生错误", e);
                }
            }

            @Override
            public void onFail(SpeechSynthesizerResponse response) {
                log.error("语音合成失败 - TaskId: {}, 状态码: {}, 错误信息: {}", 
                    response.getTaskId(), response.getStatus(), response.getStatusText());
                try {
                    // 发送错误消息
                    session.sendMessage(new TextMessage("{\"type\":\"error\",\"message\":\"" + 
                        response.getStatusText() + "\"}"));
                    session.close(CloseStatus.SERVER_ERROR);
                } catch (IOException e) {
                    log.error("发送错误消息时发生错误", e);
                }
            }
        };
    }
}

