package com.deepseek.deepseek_chat.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.Ordered;
import org.springframework.boot.web.servlet.FilterRegistrationBean;

/**
 * CSP报告模式配置
 * 仅在csp-test profile激活时生效
 */
@Configuration
@Profile("csp-test")
public class SecurityConfigReportOnly {
    
    @Bean
    public FilterRegistrationBean<CspReportOnlyFilter> cspReportOnlyFilter() {
        FilterRegistrationBean<CspReportOnlyFilter> registrationBean = new FilterRegistrationBean<>();
        registrationBean.setFilter(new CspReportOnlyFilter());
        registrationBean.addUrlPatterns("/*");
        registrationBean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registrationBean;
    }
} 