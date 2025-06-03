package com.deepseek.deepseek_chat.config;

import java.io.IOException;
import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
    
    private static final Logger logger = LoggerFactory.getLogger(VoiceChatConfig.class);
    
    @Value("${aliyun.ak.id:${ALIYUN_AK_ID:}}")
    private String accessKeyId;
    
    @Value("${aliyun.ak.secret:${ALIYUN_AK_SECRET:}}")
    private String accessKeySecret;
    
    @Value("${aliyun.nls.appkey:${NLS_APP_KEY:}}")
    private String apiKey;
    
    // 语音服务接入点（开发环境使用外网WSS，生产环境使用内网WS）
    private static final String DEV_ENDPOINT = "wss://nls-gateway-cn-shenzhen.aliyuncs.com/ws/v1";
    
    // 生产环境接入点（部署时使用）
    @SuppressWarnings("unused")
	private static final String PROD_ENDPOINT = "ws://nls-gateway-cn-shenzhen-internal.aliyuncs.com:80/ws/v1";
    
    // 当前使用的接入点（默认使用开发环境接入点）
    private static final String ENDPOINT = DEV_ENDPOINT;
    
    // 音频参数
    private static final int SAMPLE_RATE = 16000; // 16k采样率
    private static final String FORMAT = "wav"; // 音频格式
    
    @PostConstruct
    public void init() {
        logger.info("=== 阿里云语音服务配置初始化 ===");
        logger.info("AccessKey ID长度: {}", accessKeyId.length());
        logger.info("AccessKey Secret长度: {}", accessKeySecret.length());
        logger.info("AppKey长度: {}", apiKey.length());
        
        if (accessKeyId.isEmpty()) {
            logger.error("ALIYUN_AK_ID 未设置或为空");
        }
        if (accessKeySecret.isEmpty()) {
            logger.error("ALIYUN_AK_SECRET 未设置或为空");
        }
        if (apiKey.isEmpty()) {
            logger.error("NLS_APP_KEY 未设置或为空");
        }
    }
    
    /**
     * 初始化AccessToken
     */
    @Bean
    public AccessToken accessToken() throws IOException {
        if (accessKeyId.isEmpty() || accessKeySecret.isEmpty()) {
            logger.error("阿里云AccessKey未配置，请检查环境变量：");
            logger.error("ALIYUN_AK_ID: [{}]", accessKeyId);
            logger.error("ALIYUN_AK_SECRET: [{}]", accessKeySecret.substring(0, Math.min(5, accessKeySecret.length())) + "...");
            throw new IllegalStateException("阿里云AccessKey未配置");
        }
        
        try {
            logger.info("开始创建AccessToken...");
            AccessToken token = new AccessToken(accessKeyId, accessKeySecret);
            token.apply();
            logger.info("阿里云AccessToken创建成功");
            return token;
        } catch (IOException e) {
            logger.error("阿里云AccessToken创建失败: {}", e.getMessage(), e);
            throw e;
        }
    }
    
    /**
     * 初始化语音服务客户端
     * NlsClient是线程安全的，建议全局仅创建一个实例
     */
    @Bean
    public NlsClient nlsClient(AccessToken accessToken) {
        if (apiKey.isEmpty()) {
            logger.error("阿里云AppKey未配置: [{}]", apiKey);
            throw new IllegalStateException("阿里云AppKey未配置");
        }
        
        try {
            logger.info("开始创建语音服务客户端...");
            NlsClient client = new NlsClient(ENDPOINT, accessToken.getToken());
            logger.info("阿里云语音服务客户端创建成功");
            return client;
        } catch (Exception e) {
            logger.error("阿里云语音服务客户端创建失败: {}", e.getMessage(), e);
            throw new IllegalStateException("语音服务客户端创建失败", e);
        }
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
