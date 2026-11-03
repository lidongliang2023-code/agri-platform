package com.agri.platform.internal.account;

import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * TOTP（RFC 6238）实现。
 *
 * <p>与常见手机验证器（Google Authenticator / 微软 Authenticator / 1Password）兼容：
 * HMAC-SHA1、30 秒步长、6 位数字、Base32 密钥。</p>
 *
 * <p><b>为什么允许 ±1 个时间步</b>：手机与服务器的时钟通常有几秒到几十秒的偏差，
 * 只认当前步会让一部分用户永远验证不过。放一个步长的窗口是行业惯例
 * （RFC 6238 第 5.2 节建议），不是安全妥协到不可接受的程度。</p>
 */
@Component
public class TotpService {

    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final int STEP_SECONDS = 30;
    private static final int DIGITS = 6;
    private static final int WINDOW = 1;
    private static final int SECRET_BYTES = 20;

    private final SecureRandom random = new SecureRandom();

    /** 生成 Base32 密钥（160 位，与 RFC 4226 建议一致） */
    public String generateSecret() {
        byte[] bytes = new byte[SECRET_BYTES];
        random.nextBytes(bytes);
        return base32Encode(bytes);
    }

    /** 当前时间步 */
    public long currentStep() {
        return System.currentTimeMillis() / 1000L / STEP_SECONDS;
    }

    /**
     * 校验验证码。
     *
     * @param secret  Base32 密钥
     * @param code    用户输入的 6 位数字
     * @param lastStep 上次成功的时间步（防重放）；可传 null
     * @return 命中的时间步；不匹配返回 -1
     */
    public long verify(String secret, String code, Long lastStep) {
        if (secret == null || code == null) {
            return -1L;
        }
        String normalized = code.replaceAll("\\s", "");
        if (normalized.length() != DIGITS || !normalized.matches("\\d{6}")) {
            return -1L;
        }
        long step = currentStep();
        for (int offset = -WINDOW; offset <= WINDOW; offset++) {
            long candidate = step + offset;
            if (lastStep != null && candidate <= lastStep) {
                // 同一时间步（或更早）已经用过，拒绝重放
                continue;
            }
            if (normalized.equals(code(secret, candidate))) {
                return candidate;
            }
        }
        return -1L;
    }

    /** 按指定时间步计算 6 位验证码 */
    public String code(String secret, long step) {
        byte[] key = base32Decode(secret);
        byte[] data = new byte[8];
        long value = step;
        for (int i = 7; i >= 0; i--) {
            data[i] = (byte) (value & 0xFF);
            value >>= 8;
        }
        byte[] hash = hmacSha1(key, data);
        int offset = hash[hash.length - 1] & 0x0F;
        int binary = ((hash[offset] & 0x7F) << 24)
                | ((hash[offset + 1] & 0xFF) << 16)
                | ((hash[offset + 2] & 0xFF) << 8)
                | (hash[offset + 3] & 0xFF);
        return String.format("%0" + DIGITS + "d", binary % 1_000_000);
    }

    /** otpauth:// URI，供验证器扫码 */
    public String otpauthUri(String issuer, String account, String secret) {
        String label = urlEncode(issuer + ":" + account);
        return String.format(
                "otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d",
                label, secret, urlEncode(issuer), DIGITS, STEP_SECONDS);
    }

    private static String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static byte[] hmacSha1(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            return mac.doFinal(data);
        } catch (Exception e) {
            throw new IllegalStateException("TOTP 计算失败", e);
        }
    }

    /* ---------- Base32（RFC 4648，无填充，标准字母表） ---------- */

    static String base32Encode(byte[] bytes) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bitsLeft = 0;
        for (byte b : bytes) {
            buffer = (buffer << 8) | (b & 0xFF);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                out.append(ALPHABET.charAt((buffer >> (bitsLeft - 5)) & 0x1F));
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) {
            out.append(ALPHABET.charAt((buffer << (5 - bitsLeft)) & 0x1F));
        }
        return out.toString();
    }

    static byte[] base32Decode(String encoded) {
        String input = encoded.replace("=", "").replace(" ", "").toUpperCase();
        int buffer = 0;
        int bitsLeft = 0;
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        for (int i = 0; i < input.length(); i++) {
            int index = ALPHABET.indexOf(input.charAt(i));
            if (index < 0) {
                throw new IllegalArgumentException("非法的 Base32 字符：" + input.charAt(i));
            }
            buffer = (buffer << 5) | index;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                out.write((buffer >> (bitsLeft - 8)) & 0xFF);
                bitsLeft -= 8;
            }
        }
        return out.toByteArray();
    }
}
