package com.deepseek.deepseek_chat.controller;

import com.deepseek.deepseek_chat.service.HomeworkService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/homework")
public class HomeworkController {
    
    private static final Logger logger = LoggerFactory.getLogger(HomeworkController.class);
    
    @Autowired
    private HomeworkService homeworkService;
    
    @PostMapping(value = "/check", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> checkHomework(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam("subject") String subject,
            @RequestParam("sessionId") String sessionId,
            HttpServletRequest request) {
        
        // 记录请求信息
        logger.info("收到作业检查请求 - 会话ID: {}, 科目: {}, 文件数量: {}, 用户代理: {}", 
                sessionId, subject, files.size(), request.getHeader("User-Agent"));
        
        // 参数验证
        if (files == null || files.isEmpty()) {
            logger.error("未接收到文件");
            return ResponseEntity.badRequest()
                .header("X-Error-Message", "未接收到文件")
                .body(null);
        }
        
        if (subject == null || subject.trim().isEmpty()) {
            logger.error("未指定科目");
            return ResponseEntity.badRequest()
                .header("X-Error-Message", "未指定科目")
                .body(null);
        }
        
        if (sessionId == null || sessionId.trim().isEmpty()) {
            logger.error("未提供会话ID");
            return ResponseEntity.badRequest()
                .header("X-Error-Message", "未提供会话ID")
                .body(null);
        }
        
        // 记录每个文件的信息
        files.forEach(file -> {
            logger.info("文件信息 - 名称: {}, 大小: {} bytes, 类型: {}, 内容类型: {}", 
                    file.getOriginalFilename(), 
                    file.getSize(), 
                    file.getContentType(),
                    file.getContentType());
        });
        
        try {
            // 检查是否为移动设备
            String userAgent = request.getHeader("User-Agent");
            boolean isMobile = userAgent != null && 
                (userAgent.contains("Mobile") || userAgent.contains("Android"));
            
            logger.info("设备类型: {}", isMobile ? "移动设备" : "桌面设备");
            
            SseEmitter emitter = homeworkService.checkHomework(files, subject, sessionId);
            
            // 设置响应头
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_EVENT_STREAM);
            headers.setCacheControl(CacheControl.noCache());
            headers.set("X-Accel-Buffering", "no");
            
            if (isMobile) {
                // 移动设备特殊处理
                headers.set("Connection", "keep-alive");
                headers.set("Transfer-Encoding", "chunked");
            }
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(emitter);
                
        } catch (Exception e) {
            logger.error("处理作业检查请求时出错", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .header("X-Error-Message", e.getMessage())
                .body(null);
        }
    }
    
    @PostMapping(value = "/XFCheck", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> xfCheckHomework(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam("subject") String subject,
            @RequestParam("sessionId") String sessionId,
            HttpServletRequest request) {
        
        // 记录请求信息
        logger.info("收到作业检查请求(讯飞OCR) - 会话ID: {}, 科目: {}, 文件数量: {}, 用户代理: {}", 
                sessionId, subject, files.size(), request.getHeader("User-Agent"));
        
        // 参数验证
        if (files == null || files.isEmpty()) {
            logger.error("未接收到文件");
            return ResponseEntity.badRequest()
                .header("X-Error-Message", "未接收到文件")
                .body(null);
        }
        
        if (subject == null || subject.trim().isEmpty()) {
            logger.error("未指定科目");
            return ResponseEntity.badRequest()
                .header("X-Error-Message", "未指定科目")
                .body(null);
        }
        
        if (sessionId == null || sessionId.trim().isEmpty()) {
            logger.error("未提供会话ID");
            return ResponseEntity.badRequest()
                .header("X-Error-Message", "未提供会话ID")
                .body(null);
        }
        
        // 记录每个文件的信息
        files.forEach(file -> {
            logger.info("文件信息 - 名称: {}, 大小: {} bytes, 类型: {}, 内容类型: {}", 
                    file.getOriginalFilename(), 
                    file.getSize(), 
                    file.getContentType(),
                    file.getContentType());
        });
        
        try {
            // 检查是否为移动设备
            String userAgent = request.getHeader("User-Agent");
            boolean isMobile = userAgent != null && 
                (userAgent.contains("Mobile") || userAgent.contains("Android"));
            
            logger.info("设备类型: {}", isMobile ? "移动设备" : "桌面设备");
            
            SseEmitter emitter = homeworkService.ocrCheckHomework(files, subject, sessionId);
            
            // 设置响应头
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_EVENT_STREAM);
            headers.setCacheControl(CacheControl.noCache());
            headers.set("X-Accel-Buffering", "no");
            
            if (isMobile) {
                // 移动设备特殊处理
                headers.set("Connection", "keep-alive");
                headers.set("Transfer-Encoding", "chunked");
            }
            
            return ResponseEntity.ok()
                    .headers(headers)
                    .body(emitter);
                
        } catch (Exception e) {
            logger.error("处理作业检查请求时出错", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .header("X-Error-Message", e.getMessage())
                .body(null);
        }
    }

    /**
     * 普通作业批改接口
     */
    @PostMapping("/check")
    public SseEmitter checkHomework(@RequestParam("files") List<MultipartFile> files,
                                  @RequestParam("subject") String subject,
                                  @RequestParam("sessionId") String sessionId) {
        logger.info("收到作业批改请求 - 文件数量: {}, 科目: {}, 会话ID: {}", files.size(), subject, sessionId);
        return homeworkService.checkHomework(files, subject, sessionId);
    }

    /**
     * 高级版作业批改接口（使用讯飞OCR）
     */
    @PostMapping("/check-pro")
    public SseEmitter checkHomeworkPro(@RequestParam("files") List<MultipartFile> files,
                                     @RequestParam("subject") String subject,
                                     @RequestParam("sessionId") String sessionId) {
        logger.info("收到高级版作业批改请求 - 文件数量: {}, 科目: {}, 会话ID: {}", files.size(), subject, sessionId);
        return homeworkService.ocrCheckHomework(files, subject, sessionId);
    }
} 