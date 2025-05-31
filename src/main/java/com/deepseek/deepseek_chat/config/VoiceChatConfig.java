package com.deepseek.deepseek_chat.config;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.alibaba.nls.client.AccessToken;
import com.alibaba.nls.client.protocol.NlsClient;

/**
 * 阿里云语音服务配置类
 */
@Configuration
public class VoiceChatConfig {
    
    @Value("${aliyun.ak.id:${ALIYUN_AK_ID:}}")
    private String accessKeyId;
    
    @Value("${aliyun.ak.secret:${ALIYUN_AK_SECRET:}}")
    private String accessKeySecret;
    
    @Value("${aliyun.nls.appkey:${NLS_APP_KEY:}}")
    private String apiKey;
    
    // 语音服务接入点（深圳内网）
    private static final String ENDPOINT = "ws://nls-gateway-cn-shenzhen-internal.aliyuncs.com:80/ws/v1";
    
    // 音频参数
    private static final int SAMPLE_RATE = 16000; // 16k采样率
    private static final String FORMAT = "wav"; // 音频格式
    
    /**
     * 初始化AccessToken
     */
    @Bean
    public AccessToken accessToken() throws IOException {
        AccessToken token = new AccessToken(accessKeyId, accessKeySecret);
        token.apply();
        return token;
    }
    
    /**
     * 初始化语音服务客户端
     * NlsClient是线程安全的，建议全局仅创建一个实例
     */
    @Bean
    public NlsClient nlsClient(AccessToken accessToken) {
        return new NlsClient(ENDPOINT, accessToken.getToken());
    }
    
    /**
     * 获取语音服务接入点
     */
    public String getEndpoint() {
        return ENDPOINT;
    }
    
    /**
     * 获取API密钥
     */
    public String getApiKey() {
        return apiKey;
    }
    
    /**
     * 获取音频采样率
     */
    public int getSampleRate() {
        return SAMPLE_RATE;
    }
    
    /**
     * 获取音频格式
     */
    public String getFormat() {
        return FORMAT;
    }
}
