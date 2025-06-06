package com.deepseek.deepseek_chat.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alibaba.nls.client.AccessToken;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 阿里云语音识别Token生成控制器
 */
@RestController
@RequestMapping("/api/token")
public class TokenController {
    
    private static final Logger logger = LoggerFactory.getLogger(TokenController.class);
    
    // 支持从application.properties配置或环境变量获取AccessKeyId
    @Value("${aliyun.ak.id:${ALIYUN_AK_ID:}}")
    private String accessKeyId;
    
    // 支持从application.properties配置或环境变量获取AccessKeySecret
    @Value("${aliyun.ak.secret:${ALIYUN_AK_SECRET:}}")
    private String accessKeySecret;

    /**
     * 获取阿里云访问密钥并生成Token
     * 支持从配置文件或环境变量获取密钥
     * @return Token和过期时间
     */
    @GetMapping("/generate")
    public ResponseEntity<Map<String, Object>> generateToken() {
   
        // 使用通过@Value注入的变量，支持配置文件和环境变量两种方式
        if (accessKeyId == null || accessKeyId.isEmpty() || accessKeySecret == null || accessKeySecret.isEmpty()) {
            logger.error("阿里云访问密钥未配置");
            Map<String, Object> error = new HashMap<>();
            error.put("error", "阿里云访问密钥未配置，请在application.properties文件中配置aliyun.ak.id和aliyun.ak.secret或设置环境变量ALIYUN_AK_ID和ALIYUN_AK_SECRET");
            return ResponseEntity.badRequest().body(error);
        }
        
        AccessToken accessToken = new AccessToken(accessKeyId, accessKeySecret);
        try {
            accessToken.apply();
            Map<String, Object> result = new HashMap<>();
            result.put("token", accessToken.getToken());
            
            // 阿里云返回的过期时间可能是以秒为单位的时间戳
            // 根据阿里云文档，Token有效期为12小时，所以我们直接计算当前时间+12小时
            java.time.ZonedDateTime now = java.time.ZonedDateTime.now();
            java.time.ZonedDateTime expireTime = now.plusHours(12);
            String formattedExpireTime = expireTime.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            
            result.put("expireTime", formattedExpireTime);
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "获取Token失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(error);
        }
    }
}
