package com.deepseek.deepseek_chat.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.ContextClosedEvent;
import org.springframework.context.event.EventListener;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class ShutdownConfig {
    
    private static final Logger logger = LoggerFactory.getLogger(ShutdownConfig.class);
    
    @Value("${file.upload-dir:${user.home}/deepseek/uploads}")
    private String uploadDir;
    
    @EventListener(ContextClosedEvent.class)
    public void onApplicationShutdown() {
        logger.info("应用程序正在关闭，开始清理资源...");
        
        // 清理上传目录
        try {
            Path uploadPath = Paths.get(uploadDir);
            if (Files.exists(uploadPath)) {
                Files.walk(uploadPath)
                    .sorted((p1, p2) -> -p1.compareTo(p2)) // 反向排序，确保先删除文件再删除目录
                    .forEach(path -> {
                        try {
                            Files.delete(path);
                            logger.debug("已删除文件: {}", path);
                        } catch (IOException e) {
                            logger.error("删除文件失败: " + path, e);
                        }
                    });
                logger.info("已清理上传目录: {}", uploadDir);
            }
        } catch (IOException e) {
            logger.error("清理上传目录时出错", e);
        }
        
        logger.info("资源清理完成");
    }
} 