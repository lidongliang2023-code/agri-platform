package com.agri.platform.internal.sso;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Base64;
import java.util.Collections;
import java.util.UUID;

// 授权码（V2.0 第 5.2 节 ⑤~⑦）：一次性、短时效，并与 PKCE 的 code_challenge 绑定。
//
// 两点值得说明：
//   1. 取出即删除 —— 授权码只能换一次票。用 getAndDelete 而不是 get + delete，
//      后者在并发下存在"同一个码换两次票"的窗口。
//   2. PKCE —— 授权码要经浏览器地址栏与回跳链路传递，可能被截获；
//      绑上 code_challenge 后，光有 code、没有 code_verifier 换不到令牌。
@Component
@RequiredArgsConstructor
public class AuthorizationCodeService {

    private static final String KEY_PREFIX = "agri:sso:code:";
    // 换行不可能出现在 client_id / redirect_uri / challenge 里，作字段分隔不会歧义
    private static final String FIELD_SEPARATOR = "\n";

    // "取出即删除"必须是原子的：分成 GET + DEL 两步时，并发下存在同一个码换两次票的窗口。
    // 用 Lua 而不是 ValueOperations.getAndDelete —— 后者对应 Redis 的 GETDEL 命令，
    // 需要 Redis 6.2+；本机（以及很多已有环境）跑的是更老的版本，会直接报 RedisSystemException。
    // Lua 在所有版本上都是一次 RTT 内原子执行。
    private static final RedisScript<String> CONSUME_SCRIPT = RedisScript.of(
            "local value = redis.call('GET', KEYS[1]) "
                    + "if value then redis.call('DEL', KEYS[1]) end "
                    + "return value",
            String.class);

    private final StringRedisTemplate redis;
    private final SsoProperties properties;

    /** 授权码内容 */
    public record AuthorizationCode(long userId, long marketId, String clientId, String redirectUri,
                                    String codeChallenge, String codeChallengeMethod) {
    }

    /**
     * 签发授权码。
     *
     * @return 授权码本体（要进 URL，故用不可猜测的随机串）
     */
    public String issue(long userId, long marketId, String clientId, String redirectUri,
                        String codeChallenge, String codeChallengeMethod) {
        String code = UUID.randomUUID().toString().replace("-", "");
        String payload = String.join(FIELD_SEPARATOR,
                String.valueOf(userId), String.valueOf(marketId), clientId, redirectUri,
                codeChallenge == null ? "" : codeChallenge,
                codeChallengeMethod == null ? "" : codeChallengeMethod);
        redis.opsForValue().set(KEY_PREFIX + code, payload, Duration.ofSeconds(properties.getCodeTtlSeconds()));
        return code;
    }

    /**
     * 消费授权码（取出即删除）。
     *
     * @param code 授权码
     * @return 授权码内容
     */
    public AuthorizationCode consume(String code) {
        String payload = redis.execute(CONSUME_SCRIPT, Collections.singletonList(KEY_PREFIX + code));
        if (payload == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "授权码无效、已过期或已被使用");
        }
        String[] parts = payload.split(FIELD_SEPARATOR, -1);
        return new AuthorizationCode(Long.parseLong(parts[0]), Long.parseLong(parts[1]),
                parts[2], parts[3], parts[4], parts[5]);
    }

    /**
     * 校验 PKCE（S256）：base64url(sha256(code_verifier)) 必须等于 code_challenge。
     *
     * <p>未携带 challenge 的客户端视为迁移窗口（老前端）放行 —— 这条口子应在所有客户端
     * 接入 SSO 后关掉，否则 PKCE 形同虚设。</p>
     */
    public void verifyPkce(AuthorizationCode code, String codeVerifier) {
        if (code.codeChallenge() == null || code.codeChallenge().isBlank()) {
            return;
        }
        if (codeVerifier == null || codeVerifier.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "缺少 code_verifier");
        }
        if (!"S256".equalsIgnoreCase(code.codeChallengeMethod())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "仅支持 code_challenge_method=S256");
        }
        // 定长比较：普通 equals 在首个不同字符处短路，理论上可被用来逐字符试探
        byte[] expected = code.codeChallenge().getBytes(StandardCharsets.US_ASCII);
        byte[] actual = s256(codeVerifier).getBytes(StandardCharsets.US_ASCII);
        if (!MessageDigest.isEqual(expected, actual)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "code_verifier 与 code_challenge 不匹配");
        }
    }

    /** S256：sha256 后 base64url（无填充） */
    static String s256(String verifier) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(digest.digest(verifier.getBytes(StandardCharsets.US_ASCII)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("JVM 缺少 SHA-256", e);
        }
    }
}
