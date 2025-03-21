package com.deepseek.deepseek_chat.config;

import com.alibaba.dashscope.aigc.generation.Generation;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DashScopeConfig {
    
    @Bean
    protected  Generation generation() {
        return new Generation();
    }
} 