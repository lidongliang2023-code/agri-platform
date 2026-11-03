package com.agri.info.media;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;

/**
 * 培训课程播放地址签发器。
 *
 * <p>与网关的 {@code secure_link} 对齐，nginx 侧配置：</p>
 * <pre>
 * secure_link $arg_e,$arg_s;
 * secure_link_md5 "$secure_link_expires$uri agri-vod-dev-secret";
 * </pre>
 *
 * <p>即被 md5 的原文是 <code>&lt;过期秒级时间戳&gt;&lt;URI&gt;&lt;空格&gt;&lt;密钥&gt;</code>，
 * 结果取 16 字节原始摘要做 base64url（去 padding）—— 注意不是 md5 的十六进制字符串，
 * 这是 secure_link 最容易踩的一个坑：签成 hex 会永远校验不过。</p>
 *
 * <p>签名只绑 URI 与过期时间，不绑客户端 IP。原因是移动端在 4G/WiFi 之间切换会换出口 IP，
 * 绑 IP 会让用户"走着走着视频突然 403"。要更强防盗链应改绑设备指纹或走 DRM，而不是绑 IP。</p>
 */
@Service
public class VodSigner {

    private final VodProperties properties;

    public VodSigner(VodProperties properties) {
        this.properties = properties;
    }

    /** 把相对路径补成对外 URI（与 nginx 的 $uri 同形）。 */
    public String toUri(String relativePath) {
        String path = relativePath == null ? "" : relativePath.trim();
        String base = properties.getPublicPath();
        if (!base.endsWith("/")) {
            base = base + "/";
        }
        // 允许调用方直接传完整路径（运维在库里手工填过 /vod/xxx 的情况），避免拼出 /vod//vod/xxx。
        if (path.startsWith(base)) {
            path = path.substring(base.length());
        }
        while (path.startsWith("/")) {
            path = path.substring(1);
        }
        return base + path;
    }

    /** 计算签名：base64url(md5("<expires><uri> <secret>"))，与 nginx secure_link_md5 等价。 */
    public String sign(String relativePath, long expiresAtEpochSecond) {
        String raw = expiresAtEpochSecond + toUri(relativePath) + " " + properties.getSecret();
        try {
            byte[] digest = MessageDigest.getInstance("MD5").digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("当前运行环境缺少 MD5 实现，无法签发播放地址", e);
        }
    }

    /** 生成带签名的播放地址（相对路径形式，由调用方按端拼上 origin）。 */
    public String buildPlayUrl(String relativePath) {
        long expiresAt = Instant.now().getEpochSecond() + properties.getTicketTtlSeconds();
        return toUri(relativePath) + "?e=" + expiresAt + "&s=" + sign(relativePath, expiresAt);
    }

    public long ticketTtlSeconds() {
        return properties.getTicketTtlSeconds();
    }

    public VodProperties properties() {
        return properties;
    }
}
