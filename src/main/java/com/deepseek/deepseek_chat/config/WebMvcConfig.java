package com.deepseek.deepseek_chat.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;


@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    
    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        // 静态资源映射
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/")
                .setCachePeriod(0);
        
        // Socket.IO 资源映射
        registry.addResourceHandler("/socket.io/**")
                .addResourceLocations("classpath:/static/socket.io/")
                .setCachePeriod(0);
        
        // 模板资源映射
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/templates/")
                .setCachePeriod(0);
        
        // Vendor 资源映射
        registry.addResourceHandler("/vendor/**")
                .addResourceLocations("classpath:/static/vendor/")
                .setCachePeriod(0);
        
        // Chat 相关资源映射
        registry.addResourceHandler("/chat/**")
                .addResourceLocations("classpath:/static/chat/")
                .setCachePeriod(0);
        
        registry.addResourceHandler("/chat/css/**")
                .addResourceLocations("classpath:/static/chat/css/")
                .setCachePeriod(0);  // 开发时禁用缓存
        registry.addResourceHandler("/chat/js/**")
                .addResourceLocations("classpath:/static/chat/js/")
                .setCachePeriod(0);  // 开发时禁用缓存
    }

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("http://localhost:8080", "http://localhost:8081")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
} 