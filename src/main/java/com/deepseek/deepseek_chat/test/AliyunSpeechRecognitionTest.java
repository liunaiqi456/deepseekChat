package com.deepseek.deepseek_chat.test;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.alibaba.nls.client.AccessToken;
import com.alibaba.nls.client.protocol.InputFormatEnum;
import com.alibaba.nls.client.protocol.NlsClient;
import com.alibaba.nls.client.protocol.SampleRateEnum;
import com.alibaba.nls.client.protocol.asr.SpeechTranscriber;
import com.alibaba.nls.client.protocol.asr.SpeechTranscriberListener;
import com.alibaba.nls.client.protocol.asr.SpeechTranscriberResponse;

/**
 * 阿里云语音识别测试类
 * 用于测试阿里云语音识别SDK是否能正确识别示例音频文件
 */
public class AliyunSpeechRecognitionTest {
    
    private static final Logger logger = LoggerFactory.getLogger(AliyunSpeechRecognitionTest.class);
    
    // 阿里云语音服务端点
    private static final String ENDPOINT = "wss://nls-gateway-cn-shenzhen.aliyuncs.com/ws/v1";
    
    // 音频文件路径
    private static final String AUDIO_FILE_PATH = "src/main/resources/static/chat/voice/nls-sample-16k.wav";
    
    // 音频块大小（每次发送3200字节，相当于100ms的16k采样率PCM数据）
    private static final int CHUNK_SIZE = 3200;
    
    // 发送音频数据的间隔时间（模拟实时流式识别）
    private static final int SEND_INTERVAL_MS = 100;
    
    public static void main(String[] args) {
        // 从环境变量获取必要的凭证
        String accessKeyId = System.getenv("ALIYUN_AK_ID");
        String accessKeySecret = System.getenv("ALIYUN_AK_SECRET");
        String appKey = System.getenv("NLS_APP_KEY");
        
        // 检查凭证是否存在
        if (accessKeyId == null || accessKeyId.isEmpty() ||
            accessKeySecret == null || accessKeySecret.isEmpty() ||
            appKey == null || appKey.isEmpty()) {
            logger.error("请设置环境变量：ALIYUN_AK_ID, ALIYUN_AK_SECRET, NLS_APP_KEY");
            return;
        }
        
        NlsClient client = null;
        try {
            // 创建AccessToken
            logger.info("开始创建AccessToken...");
            AccessToken token = new AccessToken(accessKeyId, accessKeySecret);
            token.apply();
            logger.info("AccessToken创建成功");
            
            // 创建NlsClient实例
            logger.info("开始创建NlsClient...");
            client = new NlsClient(ENDPOINT, token.getToken());
            logger.info("NlsClient创建成功");
            
            // 测试识别示例音频文件
            testRecognizeAudioFile(client, appKey);
            
        } catch (Exception e) {
            logger.error("测试过程中发生错误: {}", e.getMessage(), e);
        } finally {
            // 关闭NlsClient
            if (client != null) {
                client.shutdown();  // 使用shutdown()代替close()
                logger.info("NlsClient已关闭");
            }
        }
    }
    
    /**
     * 测试识别音频文件
     */
    private static void testRecognizeAudioFile(NlsClient client, String appKey) throws Exception {
        logger.info("开始测试识别音频文件: {}", AUDIO_FILE_PATH);
        
        // 创建识别完成信号量
        CountDownLatch finishLatch = new CountDownLatch(1);
        
        // 创建识别监听器
        SpeechTranscriberListener listener = createListener(finishLatch);
        
        // 创建语音识别器
        SpeechTranscriber transcriber = null;
        try {
            transcriber = new SpeechTranscriber(client, listener);
            transcriber.setAppKey(appKey);
            transcriber.setFormat(InputFormatEnum.PCM);
            transcriber.setSampleRate(SampleRateEnum.SAMPLE_RATE_16K);
            transcriber.setEnableIntermediateResult(true);
            transcriber.setEnablePunctuation(true);
            transcriber.setEnableITN(true);
            
            // 启用完整句子识别和分词
            transcriber.addCustomedParam("enable_sentence_detection", true);
            transcriber.addCustomedParam("enable_words", true);
            
            // 设置通用模型，支持中英文混合识别
            transcriber.addCustomedParam("model", "universal");
            transcriber.addCustomedParam("enable_inverse_text_normalization", true);
            transcriber.addCustomedParam("enable_mixed_language", true);
            
            // 启动识别器
            logger.info("启动语音识别器...");
            transcriber.start();
            logger.info("语音识别器启动成功");
            
            // 读取并发送音频数据
            sendAudioData(transcriber);
            
            // 停止识别器
            logger.info("停止语音识别器...");
            transcriber.stop();
            
            // 等待识别完成
            logger.info("等待识别完成...");
            finishLatch.await(15, TimeUnit.SECONDS);
            logger.info("识别过程结束");
            
        } finally {
            // 关闭识别器
            if (transcriber != null) {
                transcriber.close();
                logger.info("语音识别器已关闭");
            }
        }
    }
    
    /**
     * 创建语音识别监听器
     */
    private static SpeechTranscriberListener createListener(CountDownLatch finishLatch) {
        return new SpeechTranscriberListener() {
            @Override
            public void onTranscriptionResultChange(SpeechTranscriberResponse response) {
                // 处理中间识别结果
                String result = response.getTransSentenceText();
                logger.info("【中间识别结果】: {}", result);
            }
            
            @Override
            public void onSentenceEnd(SpeechTranscriberResponse response) {
                // 处理句子结束事件
                String result = response.getTransSentenceText();
                logger.info("【句子结束】: {}", result);
            }
            
            @Override
            public void onTranscriptionComplete(SpeechTranscriberResponse response) {
                // 处理识别完成事件
                logger.info("【识别完成】: 状态码={}, 状态信息={}", 
                        response.getStatus(), response.getStatusText());
                
                // 释放信号量，通知主线程识别已完成
                finishLatch.countDown();
            }
            
            @Override
            public void onFail(SpeechTranscriberResponse response) {
                // 处理识别失败事件
                logger.error("【识别失败】: 状态码={}, 状态信息={}", 
                        response.getStatus(), response.getStatusText());
                
                // 释放信号量，通知主线程识别已完成
                finishLatch.countDown();
            }
            
            @Override
            public void onSentenceBegin(SpeechTranscriberResponse response) {
                // 处理句子开始事件
                logger.info("【句子开始】: TaskId={}", response.getTaskId());
            }
            
            @Override
            public void onTranscriberStart(SpeechTranscriberResponse response) {
                // 处理识别器启动事件
                logger.info("【识别器启动】: TaskId={}", response.getTaskId());
            }
        };
    }
    
    /**
     * 读取并发送音频数据
     */
    private static void sendAudioData(SpeechTranscriber transcriber) throws IOException {
        File audioFile = new File(AUDIO_FILE_PATH);
        if (!audioFile.exists()) {
            logger.error("音频文件不存在: {}", AUDIO_FILE_PATH);
            return;
        }
        
        logger.info("开始读取音频文件: {}, 文件大小: {} 字节", AUDIO_FILE_PATH, audioFile.length());
        
        // 跳过WAV文件头（44字节）
        try (InputStream inputStream = new FileInputStream(audioFile)) {
            // 跳过WAV文件头
            inputStream.skip(44);
            
            // 读取并发送音频数据
            byte[] buffer = new byte[CHUNK_SIZE];
            int bytesRead;
            int totalSent = 0;
            
            while ((bytesRead = inputStream.read(buffer)) != -1) {
                // 如果读取的数据不足一个完整的块，创建一个新的数组
                byte[] dataToSend;
                if (bytesRead < CHUNK_SIZE) {
                    dataToSend = new byte[bytesRead];
                    System.arraycopy(buffer, 0, dataToSend, 0, bytesRead);
                } else {
                    dataToSend = buffer;
                }
                
                // 发送音频数据
                transcriber.send(dataToSend);
                totalSent += bytesRead;
                
                logger.debug("已发送 {} 字节音频数据，总计: {} 字节", bytesRead, totalSent);
                
                // 模拟实时流式识别，每次发送后等待一段时间
                try {
                    Thread.sleep(SEND_INTERVAL_MS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            
            logger.info("音频数据发送完成，总计发送: {} 字节", totalSent);
        }
    }
}
