package com.deepseek.deepseek_chat.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.beans.factory.annotation.Value;
import java.io.File;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.config.annotation.ContentNegotiationConfigurer;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.HandlerInterceptor;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;


@Configuration
public class WebMvcConfig implements WebMvcConfigurer {
    
    @Value("${file.upload-dir:${user.home}/deepseek/uploads}")
    private String uploadDir;
    
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
        
        // 添加上传文件的资源映射
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadDir + File.separator)
                .setCachePeriod(3600);
    }

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Content-Type", "Content-Disposition", "Cache-Control", "X-Content-Type-Options")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void configureContentNegotiation(@NonNull ContentNegotiationConfigurer configurer) {
        configurer
            .favorParameter(true)
            .parameterName("mediaType")
            .ignoreAcceptHeader(false)
            .useRegisteredExtensionsOnly(false)
            .defaultContentType(MediaType.TEXT_HTML)
            .mediaType("html", MediaType.TEXT_HTML)
            .mediaType("json", MediaType.APPLICATION_JSON)
            .mediaType("event-stream", MediaType.TEXT_EVENT_STREAM);
    }

    // 添加自定义响应头配置
    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull Object handler) {
                // 获取请求主机
                String host = request.getServerName();
                boolean isLocalhost = "localhost".equalsIgnoreCase(host) || "127.0.0.1".equals(host);
                boolean isSecure = request.isSecure();
                
                // 基础安全头
                response.setHeader("X-Content-Type-Options", "nosniff");
                response.setHeader("X-Frame-Options", "SAMEORIGIN");
                response.setHeader("X-XSS-Protection", "1; mode=block");
                
                // 只在localhost或HTTPS下设置COOP和COEP
                if (isLocalhost || isSecure) {
                    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                    response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
                }
                
                // 构建CSP策略
                StringBuilder cspBuilder = new StringBuilder();
                cspBuilder.append("default-src 'self'; ");
                
                // 根据请求来源构建connect-src
                if (isLocalhost) {
                    cspBuilder.append("connect-src 'self' ws://localhost:8081 wss://localhost:8081 http://localhost:8080 https://localhost:8080; ");
                } else {
                    // 对于IP访问，允许当前主机的连接
                    cspBuilder.append("connect-src 'self' ws://").append(host).append(":8081 wss://")
                             .append(host).append(":8081 http://").append(host)
                             .append(":8080 https://").append(host).append(":8080; ");
                }
                
                // 添加其他CSP规则
                cspBuilder.append("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; ")
                         .append("style-src 'self' 'unsafe-inline'; ")
                         .append("img-src 'self' data: blob:; ")
                         .append("font-src 'self' data:; ")
                         .append("frame-src 'self';");
                
                response.setHeader("Content-Security-Policy", cspBuilder.toString());
                
                // 特别针对SSE响应
                if (request.getRequestURI().contains("/homework/check")) {
                    response.setHeader("Content-Type", "text/event-stream");
                    response.setHeader("Cache-Control", "no-cache");
                    response.setHeader("Connection", "keep-alive");
                    response.setHeader("X-Accel-Buffering", "no");
                }
                
                // 添加调试信息到响应头（仅在开发环境）
                if (isLocalhost) {
                    response.setHeader("X-Debug-Host", host);
                    response.setHeader("X-Debug-IsSecure", String.valueOf(isSecure));
                    response.setHeader("X-Debug-IsLocalhost", String.valueOf(isLocalhost));
                }
                
                return true;
            }
        });
    }
} 