package com.deepseek.deepseek_chat.config;

import com.alibaba.dashscope.aigc.generation.Generation;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DashScopeConfig {
    
    @Bean
    public Generation generation() {
        return new Generation();
    }
} 