package com.agri.platform.internal.account;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * TOTP 密钥的加密存储。
 *
 * <p><b>为什么加密而不是明文存</b>：TOTP 密钥等同于"长期第二因子"，
 * 拿到它就能无限生成验证码。数据库备份泄露、只读账号被滥用都会直接导致 2FA 失效。</p>
 *
 * <p><b>但这不等于安全</b>：密钥来自配置 {@code agri.mfa.encrypt-key}，
 * 默认值写在配置文件里，任何能读到配置的人都能解密 —— 它的作用只是
 * 「数据库单独泄露时不至于全裸」。生产环境必须通过环境变量注入独立密钥，
 * 更彻底的做法是交给 KMS/密钥服务托管。</p>
 */
@Slf4j
@Component
public class MfaCrypto {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public MfaCrypto(@Value("${agri.mfa.encrypt-key:agri-local-dev-only-change-me}") String rawKey) {
        // 任意长度口令 → 固定 256 位密钥
        this.key = new SecretKeySpec(sha256(rawKey.getBytes(StandardCharsets.UTF_8)), "AES");
        if (rawKey.contains("local-dev-only")) {
            log.warn("MFA 密钥用的是本地默认值，仅适合开发环境；生产请通过 agri.mfa.encrypt-key 注入独立密钥");
        }
    }

    /** 加密；输出 base64(iv || 密文) */
    public String encrypt(String plain) {
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] cipherText = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(cipherText, 0, out, iv.length, cipherText.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            // 加密失败不能静默降级成明文
            throw new IllegalStateException("MFA 密钥加密失败", e);
        }
    }

    /** 解密；密文被篡改会抛异常（GCM 自带完整性校验） */
    public String decrypt(String encoded) {
        try {
            byte[] all = Base64.getDecoder().decode(encoded);
            byte[] iv = new byte[IV_LENGTH];
            System.arraycopy(all, 0, iv, 0, IV_LENGTH);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] plain = cipher.doFinal(all, IV_LENGTH, all.length - IV_LENGTH);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("MFA 密钥解密失败（密钥是否被改过？）", e);
        }
    }

    private static byte[] sha256(byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
