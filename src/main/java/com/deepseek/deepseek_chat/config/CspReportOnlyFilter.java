package com.deepseek.deepseek_chat.config;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

/**
 * CSP报告模式过滤器
 * 用于在测试模式下添加CSP报告头
 */
public class CspReportOnlyFilter extends OncePerRequestFilter {
    
    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, 
                                  @NonNull HttpServletResponse response, 
                                  @NonNull FilterChain filterChain) throws ServletException, IOException {
        // 添加CSP报告头
        response.setHeader("Content-Security-Policy-Report-Only",
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data:; " +
            "connect-src 'self' ws://* wss://* http://* https://*; " +
            "report-uri /csp-report");
            
        filterChain.doFilter(request, response);
    }
} 