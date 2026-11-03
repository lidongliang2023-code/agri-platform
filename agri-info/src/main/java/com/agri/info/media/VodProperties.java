package com.agri.info.media;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 培训课程视频（VOD）配置。
 *
 * <p>密钥必须与网关 {@code secure_link_md5} 里写的那一串完全一致，
 * 否则签发出来的地址在 nginx 侧一律 403 —— 这类问题不会报"密钥错误"，
 * 只会表现为"视频打不开"，所以两处必须成对修改。</p>
 */
@Component
@ConfigurationProperties(prefix = "agri.info.vod")
public class VodProperties {

    /** 与 nginx secure_link_md5 共用的签名密钥。生产用环境变量 AGRI_VOD_SECRET 注入。 */
    private String secret = "agri-vod-dev-secret";

    /** 对外暴露的静态路径前缀，必须与 nginx 的 location 一致。 */
    private String publicPath = "/vod/";

    /** 播放地址有效期（秒）。太长等于没有防盗链，太短会让长视频播到一半失效。 */
    private long ticketTtlSeconds = 300;

    /** 视频落盘目录。必须与 nginx 的 root 指向同一个物理目录，否则"上传成功但播不了"。 */
    private String storageDir = "../ops/gateway/vod";

    /** 单文件大小上限（MB），超过直接拒绝，避免把磁盘写满。 */
    private long maxFileSizeMb = 2048;

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getPublicPath() {
        return publicPath;
    }

    public void setPublicPath(String publicPath) {
        this.publicPath = publicPath;
    }

    public long getTicketTtlSeconds() {
        return ticketTtlSeconds;
    }

    public void setTicketTtlSeconds(long ticketTtlSeconds) {
        this.ticketTtlSeconds = ticketTtlSeconds;
    }

    public String getStorageDir() {
        return storageDir;
    }

    public void setStorageDir(String storageDir) {
        this.storageDir = storageDir;
    }

    public long getMaxFileSizeMb() {
        return maxFileSizeMb;
    }

    public void setMaxFileSizeMb(long maxFileSizeMb) {
        this.maxFileSizeMb = maxFileSizeMb;
    }
}
