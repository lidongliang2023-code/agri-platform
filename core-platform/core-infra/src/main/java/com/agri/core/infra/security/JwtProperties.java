package com.agri.core.infra.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * JWT 配置：短时效访问令牌 + 服务端刷新令牌（输出规范·认证安全）。
 */
@Data
@Component
@ConfigurationProperties(prefix = "agri.jwt")
public class JwtProperties {

    /** HMAC-SHA256 密钥（≥32 字符），生产必须从环境变量注入，绝不硬编码 */
    private String secret = "agri-dev-secret-key-change-me-32bytes!";

    private long accessTtlMinutes = 120;

    private long refreshTtlDays = 7;

    private String issuer = "agri-core-platform";
}
