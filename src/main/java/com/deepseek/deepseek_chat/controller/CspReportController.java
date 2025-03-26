package com.deepseek.deepseek_chat.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * 接收CSP违规报告的控制器
 */
@RestController
public class CspReportController {
    
    private static final Logger logger = LoggerFactory.getLogger(CspReportController.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    /**
     * 接收CSP违规报告
     * 
     * @param reportBody CSP违规报告的JSON内容
     * @return ResponseEntity 响应实体
     */
    @PostMapping("/csp-report")
    public ResponseEntity<String> processCspReport(@RequestBody String reportBody) {
        try {
            // 解析JSON报告
            JsonNode report = objectMapper.readTree(reportBody);
            
            // 记录详细信息
            logger.info("收到CSP违规报告:");
            logger.info("违规类型: {}", report.path("csp-report").path("violated-directive").asText());
            logger.info("违规资源: {}", report.path("csp-report").path("blocked-uri").asText());
            logger.info("原始策略: {}", report.path("csp-report").path("original-policy").asText());
            
            // 返回成功响应
            return ResponseEntity.ok("CSP报告已接收");
        } catch (Exception e) {
            logger.error("处理CSP报告时发生错误: {}", e.getMessage());
            return ResponseEntity.badRequest().body("报告格式错误");
        }
    }
} 