package com.deepseek.deepseek_chat.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Controller
public class FileUploadController {
    
    private static final Logger logger = LoggerFactory.getLogger(FileUploadController.class);
    
    // 上传文件保存路径
    @Value("${file.upload-dir:${user.home}/deepseek/uploads}")
    private String uploadDir;
    
    /**
     * 处理文件上传
     * 
     * @param file 上传的文件
     * @param sessionId 会话ID
     * @return 文件URL和其他信息
     */
    @PostMapping("/chat/upload")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> handleFileUpload(
            @RequestParam("file") MultipartFile file,
            @RequestParam("sessionId") String sessionId) {
        
        Map<String, Object> response = new HashMap<>();
        Path filePath = null;
        
        try {
            // 检查文件是否为空
            if (file.isEmpty()) {
                response.put("success", false);
                response.put("message", "上传的文件为空");
                return ResponseEntity.badRequest().body(response);
            }
            
            // 创建保存目录（如果不存在）
            String sessionDir = uploadDir + File.separator + sessionId;
            Path uploadPath = Paths.get(sessionDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }
            
            // 生成唯一文件名
            String originalFilename = file.getOriginalFilename();
            String fileExtension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String uniqueFilename = UUID.randomUUID().toString() + fileExtension;
            
            // 保存文件
            filePath = uploadPath.resolve(uniqueFilename);
            
            // 使用try-with-resources确保输入流正确关闭
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, filePath, StandardCopyOption.REPLACE_EXISTING);
                logger.debug("文件已保存到: {}", filePath);
            }
            
            // 构建文件URL（相对路径）
            String fileUrl = "/uploads/" + sessionId + "/" + uniqueFilename;
            
            // 返回成功响应
            response.put("success", true);
            response.put("message", "文件上传成功");
            response.put("fileName", originalFilename);
            response.put("fileUrl", fileUrl);
            response.put("fileSize", file.getSize());
            
            return ResponseEntity.ok(response);
            
        } catch (IOException e) {
            logger.error("文件上传失败", e);
            
            // 如果保存失败，尝试删除已创建的文件
            if (filePath != null) {
                try {
                    Files.deleteIfExists(filePath);
                    logger.debug("已删除失败的上传文件: {}", filePath);
                } catch (IOException deleteError) {
                    logger.error("删除失败的上传文件时出错", deleteError);
                }
            }
            
            response.put("success", false);
            response.put("message", "文件上传失败: " + e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }
    
    /**
     * 清理指定会话的上传文件
     * 
     * @param sessionId 会话ID
     */
    public void cleanupSessionFiles(String sessionId) {
        try {
            Path sessionPath = Paths.get(uploadDir, sessionId);
            if (Files.exists(sessionPath)) {
                Files.walk(sessionPath)
                    .sorted((p1, p2) -> -p1.compareTo(p2)) // 反向排序，确保先删除文件再删除目录
                    .forEach(path -> {
                        try {
                            Files.delete(path);
                            logger.debug("已删除文件: {}", path);
                        } catch (IOException e) {
                            logger.error("删除文件失败: " + path, e);
                        }
                    });
            }
        } catch (IOException e) {
            logger.error("清理会话文件失败: " + sessionId, e);
        }
    }
} 