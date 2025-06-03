package com.deepseek.deepseek_chat.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.alibaba.nls.client.protocol.NlsClient;
import com.alibaba.nls.client.protocol.OutputFormatEnum;
import com.alibaba.nls.client.protocol.SampleRateEnum;
import com.alibaba.nls.client.protocol.tts.SpeechSynthesizer;
import com.alibaba.nls.client.protocol.tts.SpeechSynthesizerListener;
import com.alibaba.nls.client.protocol.tts.SpeechSynthesizerResponse;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 语音合成服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VoiceSynthesisService {

    private final NlsClient nlsClient;
    private final ObjectMapper objectMapper;
    
    @Value("${aliyun.nls.appkey:${NLS_APP_KEY:}}")
    private String appKey;

    /**
     * 将文本转换为语音
     * @param text 要转换的文本
     * @return 语音数据的字节数组
     */
    public byte[] synthesizeToSpeech(String text) throws Exception {
        ByteArrayOutputStream audioData = new ByteArrayOutputStream();
        SpeechSynthesizer synthesizer = null;

        try {
            // 创建语音合成对象
            synthesizer = new SpeechSynthesizer(nlsClient, getSynthesizerListener(audioData));
            // 设置appKey
            synthesizer.setAppKey(appKey);
            // 设置返回音频的编码格式
            synthesizer.setFormat(OutputFormatEnum.WAV);
            // 设置返回音频的采样率
            synthesizer.setSampleRate(SampleRateEnum.SAMPLE_RATE_16K);
            // 设置发音人
            synthesizer.setVoice("siyue");
            // 设置音量
            synthesizer.setVolume(50);
            // 设置语速
            synthesizer.setSpeechRate(0);
            // 设置语调
            synthesizer.setPitchRate(0);
            // 设置要转换的文本
            synthesizer.setText(text);

            // 开始语音合成
            synthesizer.start();
            // 等待语音合成完成
            synthesizer.waitForComplete();

            return audioData.toByteArray();
        } finally {
            // 关闭语音合成对象
            if (synthesizer != null) {
                synthesizer.close();
            }
        }
    }

    /**
     * 创建语音合成监听器
     */
    private SpeechSynthesizerListener getSynthesizerListener(ByteArrayOutputStream audioData) {
        return new SpeechSynthesizerListener() {
            @Override
            public void onMessage(ByteBuffer message) {
                try {
                    // 将语音数据写入字节数组输出流
                    byte[] bytesArray = new byte[message.remaining()];
                    message.get(bytesArray, 0, bytesArray.length);
                    audioData.write(bytesArray);
                } catch (IOException e) {
                    log.error("处理语音数据时发生错误", e);
                }
            }

            @Override
            public void onComplete(SpeechSynthesizerResponse response) {
                // 语音合成完成
                log.info("语音合成完成: {}", response.getStatus());
            }

            @Override
            public void onFail(SpeechSynthesizerResponse response) {
                // 语音合成失败
                log.error("语音合成失败 - TaskId: {}, 状态码: {}, 错误信息: {}", 
                    response.getTaskId(), response.getStatus(), response.getStatusText());
            }
        };
    }
    
    /**
     * 合成语音并通过WebSocket发送
     * @param text 要合成的文本
     * @param session WebSocket会话
     */
    public void synthesizeAndSend(String text, WebSocketSession session) {
        try {
            log.info("开始合成语音并发送: {}", text);
            
            // 先发送开始合成的通知
            Map<String, Object> startMessage = new HashMap<>();
            startMessage.put("type", "synthesis_start");
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(startMessage)));
            
            // 合成语音
            byte[] audioData = synthesizeToSpeech(text);
            
            // 发送合成的语音数据
            session.sendMessage(new BinaryMessage(ByteBuffer.wrap(audioData)));
            
            // 发送合成完成的通知
            Map<String, Object> completeMessage = new HashMap<>();
            completeMessage.put("type", "complete");
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(completeMessage)));
            
            log.info("语音合成并发送完成，数据大小: {}字节", audioData.length);
        } catch (Exception e) {
            log.error("合成语音并发送时发生错误", e);
            try {
                Map<String, Object> errorMessage = new HashMap<>();
                errorMessage.put("type", "error");
                errorMessage.put("content", "语音合成失败: " + e.getMessage());
                session.sendMessage(new TextMessage(objectMapper.writeValueAsString(errorMessage)));
            } catch (IOException ex) {
                log.error("发送错误消息时发生错误", ex);
            }
        }
    }
}
