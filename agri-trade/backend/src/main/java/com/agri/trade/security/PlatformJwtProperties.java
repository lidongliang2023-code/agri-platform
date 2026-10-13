package com.agri.trade.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 平台令牌配置 —— 前缀 {@code agri.jwt}，与 core-platform 的
 * {@code com.agri.core.infra.security.JwtProperties} 读的是**同一份配置键**。
 *
 * <p>为什么必须同键：架构文档 V2.0 第 5.2 节要求"网关验签后透传身份、微服务据此处理"，
 * 前提是全平台只签发**一种**访问令牌。交易模块原先既没有令牌校验、也没有配这份密钥，
 * {@code /api/trade/**} 全部裸奔 —— 不是"权限配松了"，而是压根没有认证这一层。</p>
 *
 * <p>默认值与 core-platform 的开发默认值保持一致；生产必须由环境变量
 * {@code AGRI_JWT_SECRET} 注入（≥32 字符），密钥不写死在代码库里。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "agri.jwt")
public class PlatformJwtProperties {

    /** HMAC-SHA256 密钥（≥32 字符） */
    private String secret = "agri-dev-secret-key-change-me-32bytes!";

    /** 签发者：只接受本平台签发的令牌，避免"别的系统签的令牌也当自己人" */
    private String issuer = "agri-core-platform";
}
