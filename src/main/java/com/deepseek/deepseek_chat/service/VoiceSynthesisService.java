package com.deepseek.deepseek_chat.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.alibaba.nls.client.protocol.NlsClient;
import com.alibaba.nls.client.protocol.OutputFormatEnum;
import com.alibaba.nls.client.protocol.SampleRateEnum;
import com.alibaba.nls.client.protocol.tts.SpeechSynthesizer;
import com.alibaba.nls.client.protocol.tts.SpeechSynthesizerListener;
import com.alibaba.nls.client.protocol.tts.SpeechSynthesizerResponse;

import lombok.extern.slf4j.Slf4j;

/**
 * 语音合成服务
 */
@Slf4j
@Service
public class VoiceSynthesisService {

    private final NlsClient nlsClient;
    
    @Value("${aliyun.nls.appkey:${NLS_APP_KEY:}}")
    private String appKey;

    public VoiceSynthesisService(NlsClient nlsClient) {
        this.nlsClient = nlsClient;
    }

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
}
