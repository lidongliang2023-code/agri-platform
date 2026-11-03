package com.agri.platform.internal.account;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 二次验证（TOTP）业务逻辑。
 *
 * <p>三个状态：{@code pending}（已生成密钥、未确认）→ {@code active}（已启用）
 * → {@code disabled}（已停用）。只有 active 才会在登录时要求第二因子。</p>
 *
 * <p><b>为什么设置时要先 pending 再 confirm</b>：用户扫码后可能装错应用或时间不对，
 * 直接置为 active 会把人锁在门外。必须先让他输一次正确的码，证明"这个密钥在他的
 * 验证器里能出码"，再启用。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MfaService {

    private static final String ISSUER = "丰链云";
    private static final String CHALLENGE_PREFIX = "agri:mfa:challenge:";
    private static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);
    private static final int RECOVERY_CODE_COUNT = 8;
    private static final String RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final UserMfaMapper mfaMapper;
    private final TotpService totpService;
    private final MfaCrypto mfaCrypto;
    private final StringRedisTemplate redis;
    private final SecureRandom random = new SecureRandom();

    /** 是否已启用（登录时用这个判断，别用"记录存在"判断） */
    public boolean isActive(Long userId) {
        UserMfaEntity entity = find(userId);
        return entity != null && "active".equals(entity.getStatus());
    }

    public UserMfaEntity find(Long userId) {
        return mfaMapper.selectOne(new LambdaQueryWrapper<UserMfaEntity>()
                .eq(UserMfaEntity::getUserId, userId)
                .last("LIMIT 1"));
    }

    /**
     * 开始设置：生成密钥，状态置 pending。
     *
     * <p>已经 active 的账号不允许重新生成 —— 否则任何人拿到会话就能悄悄换掉密钥，
     * 把真正的机主锁在外面。要换必须先停用。</p>
     */
    public Map<String, Object> startSetup(Long userId, String account) {
        UserMfaEntity existing = find(userId);
        if (existing != null && "active".equals(existing.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "二次验证已启用，如需更换密钥请先停用");
        }
        String secret = totpService.generateSecret();
        UserMfaEntity entity = existing == null ? new UserMfaEntity() : existing;
        entity.setUserId(userId);
        entity.setSecretCipher(mfaCrypto.encrypt(secret));
        entity.setStatus("pending");
        entity.setRecoveryCodes(null);
        entity.setEnabledAt(null);
        entity.setLastUsedAt(null);
        entity.setLastUsedStep(null);
        if (existing == null) {
            mfaMapper.insert(entity);
        } else {
            mfaMapper.updateById(entity);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("secret", secret);
        result.put("otpauthUri", totpService.otpauthUri(ISSUER, account == null ? String.valueOf(userId) : account,
                secret));
        result.put("issuer", ISSUER);
        result.put("digits", 6);
        result.put("period", 30);
        return result;
    }

    /**
     * 确认启用：校验一次验证码，通过则置 active 并下发备用码。
     *
     * @return 备用码明文（**只返回这一次**，之后库里只有哈希）
     */
    public List<String> confirm(Long userId, String code) {
        UserMfaEntity entity = find(userId);
        if (entity == null || entity.getSecretCipher() == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请先生成密钥");
        }
        if ("active".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "二次验证已启用");
        }
        String secret = mfaCrypto.decrypt(entity.getSecretCipher());
        long step = totpService.verify(secret, code, null);
        if (step < 0) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码不正确，请确认手机时间是否准确后重试");
        }
        List<String> plainCodes = generateRecoveryCodes();
        entity.setStatus("active");
        entity.setEnabledAt(LocalDateTime.now());
        entity.setLastUsedAt(LocalDateTime.now());
        entity.setLastUsedStep(step);
        entity.setRecoveryCodes(toJsonArray(
                plainCodes.stream().map(item -> sha256(normalizeRecovery(item))).toList()));
        mfaMapper.updateById(entity);
        return plainCodes;
    }

    /**
     * 校验一次验证码（TOTP 或备用码）。
     *
     * <p>备用码命中后会从列表里移除 —— 一次性使用，不能重复用同一个码登录。</p>
     *
     * @param allowRecovery 是否接受备用码（登录时接受；停用时也接受，避免手机丢了关不掉）
     */
    public boolean verifyCode(Long userId, String code, boolean allowRecovery) {
        return verify(userId, code, allowRecovery, false);
    }

    /**
     * 敏感操作（停用 / 重生成备用码）用的校验。
     *
     * <p>与登录校验的区别：**不拦重放**。登录时同一时间步只能用一次，是为了防止
     * 有人截获一个码反复使用；而停用这类动作一旦成功，码本身就没有意义了，
     * 此时再套重放保护只会让"刚登录完立刻停用"失败 —— 用户会以为功能坏了。</p>
     */
    public boolean verifyForAction(Long userId, String code) {
        return verify(userId, code, true, true);
    }

    private boolean verify(Long userId, String code, boolean allowRecovery, boolean ignoreReplay) {
        UserMfaEntity entity = find(userId);
        if (entity == null || !"active".equals(entity.getStatus())) {
            return false;
        }
        String secret = mfaCrypto.decrypt(entity.getSecretCipher());
        long step = totpService.verify(secret, code, ignoreReplay ? null : entity.getLastUsedStep());
        if (step >= 0) {
            entity.setLastUsedAt(LocalDateTime.now());
            if (!ignoreReplay) {
                entity.setLastUsedStep(step);
            }
            mfaMapper.updateById(entity);
            return true;
        }
        if (!allowRecovery) {
            return false;
        }
        String normalized = normalizeRecovery(code);
        if (normalized.isEmpty()) {
            return false;
        }
        String hash = sha256(normalized);
        List<String> hashes = parseJsonArray(entity.getRecoveryCodes());
        if (!hashes.contains(hash)) {
            return false;
        }
        hashes.remove(hash);
        entity.setRecoveryCodes(toJsonArray(hashes));
        entity.setLastUsedAt(LocalDateTime.now());
        mfaMapper.updateById(entity);
        return true;
    }

    /** 停用：必须再验一次码，防止"会话被别人拿到就直接关掉 2FA" */
    public void disable(Long userId, String code) {
        UserMfaEntity entity = find(userId);
        if (entity == null || !"active".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "二次验证未启用");
        }
        if (!verifyForAction(userId, code)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码不正确");
        }
        // 停用后整条记录清掉密钥，避免"停了但密文还留着"
        entity.setStatus("disabled");
        entity.setSecretCipher("");
        entity.setRecoveryCodes(null);
        entity.setEnabledAt(null);
        entity.setLastUsedStep(null);
        mfaMapper.updateById(entity);
    }

    /** 重新生成备用码（旧的全部作废） */
    public List<String> regenerateRecoveryCodes(Long userId, String code) {
        if (!verifyForAction(userId, code)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "验证码不正确");
        }
        List<String> plainCodes = generateRecoveryCodes();
        UserMfaEntity entity = find(userId);
        entity.setRecoveryCodes(toJsonArray(
                plainCodes.stream().map(item -> sha256(normalizeRecovery(item))).toList()));
        mfaMapper.updateById(entity);
        return plainCodes;
    }

    /** 剩余备用码数量（只给数量，不给内容） */
    public int remainingRecoveryCodes(Long userId) {
        UserMfaEntity entity = find(userId);
        return entity == null ? 0 : parseJsonArray(entity.getRecoveryCodes()).size();
    }

    /* ---------- 登录挑战 ---------- */

    /**
     * 签发一次登录挑战（密码已验证、待第二因子）。
     *
     * <p>用 Redis 存短期 token 而不是把用户 id 交给前端再传回来 ——
     * 后者等于让前端自报"我是谁"，改个 id 就能绕过第一因子。</p>
     */
    public String issueChallenge(Long userId) {
        String token = UUID.randomUUID().toString().replace("-", "");
        redis.opsForValue().set(CHALLENGE_PREFIX + token, String.valueOf(userId), CHALLENGE_TTL);
        return token;
    }

    /** 消费挑战（一次性）：返回 userId，无效或过期返回 null */
    public Long consumeChallenge(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        String key = CHALLENGE_PREFIX + token;
        String value = redis.opsForValue().get(key);
        if (value == null) {
            return null;
        }
        redis.delete(key);
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /* ---------- 内部工具 ---------- */

    private List<String> generateRecoveryCodes() {
        List<String> codes = new ArrayList<>();
        for (int i = 0; i < RECOVERY_CODE_COUNT; i++) {
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < 10; j++) {
                if (j == 5) {
                    sb.append('-');
                }
                sb.append(RECOVERY_ALPHABET.charAt(random.nextInt(RECOVERY_ALPHABET.length())));
            }
            codes.add(sb.toString());
        }
        return codes;
    }

    /**
     * 备用码归一化：去掉空格与连字符、统一大写。
     *
     * <p>生成时展示的是 {@code ABCDE-FGHIJ}（带连字符好抄），但哈希必须按归一化形式算 ——
     * 否则用户输入时去掉连字符就匹配不上（这个不一致会让备用码彻底失效）。</p>
     */
    private static String normalizeRecovery(String code) {
        return code == null ? "" : code.replaceAll("[\\s-]", "").toUpperCase();
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String toJsonArray(List<String> values) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append('"').append(values.get(i)).append('"');
        }
        return sb.append(']').toString();
    }

    private static List<String> parseJsonArray(String json) {
        List<String> out = new ArrayList<>();
        if (json == null || json.isBlank()) {
            return out;
        }
        String body = json.trim();
        if (body.startsWith("[")) {
            body = body.substring(1);
        }
        if (body.endsWith("]")) {
            body = body.substring(0, body.length() - 1);
        }
        for (String part : body.split(",")) {
            String value = part.trim().replace("\"", "");
            if (!value.isEmpty()) {
                out.add(value);
            }
        }
        return out;
    }
}
