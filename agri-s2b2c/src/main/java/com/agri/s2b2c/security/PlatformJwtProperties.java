package com.agri.s2b2c.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** 与核心平台对齐的 JWT 校验参数（只读，不签发）。 */
@Data
@Component
@ConfigurationProperties(prefix = "agri.jwt")
public class PlatformJwtProperties {
    private String secret = "agri-dev-secret-key-change-me-32bytes!";
    private String issuer = "agri-core-platform";
}
