package com.agri.masterdata.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 平台令牌配置 —— 前缀 {@code agri.jwt}，与 core-platform 的
 * {@code com.agri.core.infra.security.JwtProperties} 读的是**同一份配置键**。
 *
 * <p>为什么必须同键：V2.0 第 5.2 节第 ⑨~⑩ 步要求"网关验签后透传身份、微服务据此处理"，
 * 前提是全平台只签发**一种**访问令牌。主数据后端原先是私有密钥
 * （{@code jwt.secret=agri-masterdata-jwt-secret-key-2024}）+ 私有 issuer，
 * 于是 SSO 签发的令牌到这里必然验签失败 —— 这不是配置疏漏，是两个互不相通的令牌体系。</p>
 *
 * <p>默认值与 core-platform 的开发默认值保持一致，生产必须由环境变量
 * {@code AGRI_JWT_SECRET} 注入（≥32 字符），密钥绝不写入代码库。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "agri.jwt")
public class PlatformJwtProperties {

    /** HMAC-SHA256 密钥（≥32 字符） */
    private String secret = "agri-dev-secret-key-change-me-32bytes!";

    /** 签发者：只有本平台的令牌才被接受，防止"别的系统签的令牌也当自己人" */
    private String issuer = "agri-core-platform";
}
