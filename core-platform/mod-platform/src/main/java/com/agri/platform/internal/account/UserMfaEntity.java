package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 用户二次验证（TOTP）。
 *
 * <p>一个账号最多一条记录。`secretCipher` 是 AES-GCM 密文，不是明文密钥 ——
 * 明文只存在于「设置」接口返回的那一刻，之后不再可读。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_user_mfa")
public class UserMfaEntity extends BaseEntity {

    private Long userId;

    /** AES-GCM 加密后的 TOTP 密钥 */
    private String secretCipher;

    /** pending（已生成未确认）/ active（已启用）/ disabled（已停用） */
    private String status;

    /** 备用码的 SHA-256 哈希，JSON 数组；明文只在生成时返回一次 */
    private String recoveryCodes;

    private LocalDateTime enabledAt;
    private LocalDateTime lastUsedAt;

    /** 最近一次验证通过的时间步，用于阻止同一码被重复使用 */
    private Long lastUsedStep;
}
