package com.deepseek.deepseek_chat.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;

/**
 * 文件资源配置类，专门用于处理上传文件的资源映射
 */
@Configuration
public class FileResourceConfig implements WebMvcConfigurer {

    @Value("${file.upload-dir:${user.home}/deepseek/uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 添加上传文件的资源映射，使用简单配置方式
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadDir + File.separator)
                .setCachePeriod(3600);
    }
} 