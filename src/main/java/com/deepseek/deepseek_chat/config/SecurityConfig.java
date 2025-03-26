package com.deepseek.deepseek_chat.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * 基本安全配置
 * 安全头部已通过自定义过滤器实现
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // 禁用CSRF保护以允许WebSocket连接
        http.csrf().disable();
        
        // 允许所有请求
        http.authorizeHttpRequests()
            .anyRequest().permitAll();
            
        return http.build();
    }
} 