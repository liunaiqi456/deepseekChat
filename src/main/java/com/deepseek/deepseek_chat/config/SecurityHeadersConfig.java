package com.deepseek.deepseek_chat.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.web.header.HeaderWriter;
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter;
import org.springframework.security.web.header.writers.StaticHeadersWriter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;

@Configuration
public class SecurityHeadersConfig {
    
    @Bean
    public HeaderWriter securityHeadersWriter() {
        // 为语音聊天页面设置特殊的CSP规则
        return new DelegatingRequestMatcherHeaderWriter(
            new AntPathRequestMatcher("/chat/voice-chat"),
            new StaticHeadersWriter("Content-Security-Policy",
                "default-src 'self'; " +
                "media-src 'self' blob: data:; " +
                "script-src 'self' 'unsafe-inline'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data:; " +
                "connect-src 'self' ws: wss:;"
            )
        );
    }
}
