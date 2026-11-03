package com.agri.info.media;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 课程视频落盘。
 *
 * <p>落盘目录必须与网关 {@code location /vod/ { root .; }} 指向同一个物理目录，
 * 否则会出现「上传返回成功、播放却 404」——这类故障不会报错，只会静默播不了。</p>
 *
 * <p>文件名强制转成 ASCII（{@code lesson-20261028-153012-a1b2.mp4}）。
 * 原因是 nginx 的 {@code $uri} 是 URL 解码后的路径，而签名由后端按原始字符串计算；
 * 一旦文件名带中文，两边算出来的 md5 就对不上，表现为全部 403。</p>
 */
@Service
public class MediaStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("mp4", "m4v", "mov", "webm", "m3u8", "ts", "jpg", "jpeg", "png", "webp");

    /** 这些容器才做编码探测：webm 的 VP8/VP9 三端都能放，m3u8 是文本清单，都不必查。 */
    private static final Set<String> CODEC_CHECKED = Set.of("mp4", "m4v", "mov");

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final VodProperties properties;

    public MediaStorageService(VodProperties properties) {
        this.properties = properties;
    }

    public Map<String, Object> store(long courseId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("上传文件为空");
        }
        long limit = properties.getMaxFileSizeMb() * 1024L * 1024L;
        if (file.getSize() > limit) {
            throw new IllegalArgumentException("文件超过上限 " + properties.getMaxFileSizeMb() + "MB");
        }

        String original = file.getOriginalFilename() == null ? "video.mp4" : file.getOriginalFilename();
        String extension = extensionOf(original);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("不支持的文件类型：" + extension
                    + "（仅支持 mp4 / mov / webm / m3u8 / ts 与常见图片）");
        }

        Path root = resolveRoot();
        String folder = "course-" + courseId;
        Path directory = root.resolve(folder).normalize();
        if (!directory.startsWith(root)) {
            throw new IllegalArgumentException("非法的课程目录");
        }
        Files.createDirectories(directory);

        // 先写临时文件：编码不合格时直接删掉，不会在视频目录里留下一堆放不了的黑屏文件
        Path temp = Files.createTempFile(directory, ".uploading-", "." + extension);
        try {
            try (var input = file.getInputStream()) {
                Files.copy(input, temp, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }

            Mp4CodecInspector.Codec codec = Mp4CodecInspector.Codec.unknown();
            if (CODEC_CHECKED.contains(extension)) {
                codec = Mp4CodecInspector.inspect(temp);
                if (!codec.playable()) {
                    throw new IllegalArgumentException(
                            "视频编码是 " + codec.label() + "，浏览器与微信小程序都无法解码 —— "
                                    + "上传能成功，但播放时会黑屏且不报错。"
                                    + "请转成 H.264 后重新上传，例如：\n"
                                    + "ffmpeg -i 原文件 -c:v libx264 -profile:v high -crf 23 "
                                    + "-pix_fmt yuv420p -c:a aac -movflags +faststart 输出.mp4");
                }
            }

            String name = "lesson-" + LocalDateTime.now().format(STAMP)
                    + "-" + Integer.toHexString(ThreadLocalRandom.current().nextInt(0x10000))
                    + "." + extension;
            Path target = directory.resolve(name);
            Files.move(temp, target);

            Map<String, Object> result = new LinkedHashMap<>();
            // 返回相对路径：库里只存这个，绝对地址由 play-ticket 现场签发
            result.put("url", folder + "/" + name);
            result.put("size", file.getSize());
            result.put("originalName", original);
            result.put("contentType", file.getContentType());
            result.put("codec", codec.label());
            result.put("storageDir", root.toString());
            return result;
        } finally {
            Files.deleteIfExists(temp);
        }
    }

    /**
     * 定位视频根目录。
     *
     * <p>服务可能从仓库根启动，也可能从 agri-info/ 目录启动，相对路径会落到不同位置。
     * 这里按「配置路径 → 当前目录下 ops/gateway/vod → 上一级下 ops/gateway/vod」依次探测，
     * 都不存在时才创建配置路径。这样本地怎么启动都能写到 nginx 真正在服务的那个目录。</p>
     */
    private Path resolveRoot() throws IOException {
        Path configured = Paths.get(properties.getStorageDir()).toAbsolutePath().normalize();
        if (Files.isDirectory(configured)) {
            return configured;
        }
        Path cursor = Paths.get("").toAbsolutePath();
        for (int depth = 0; depth < 4 && cursor != null; depth++) {
            Path candidate = cursor.resolve("ops").resolve("gateway").resolve("vod");
            if (Files.isDirectory(candidate)) {
                return candidate.toAbsolutePath().normalize();
            }
            cursor = cursor.getParent();
        }
        Files.createDirectories(configured);
        return configured;
    }

    private String extensionOf(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 || dot == filename.length() - 1
                ? ""
                : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
