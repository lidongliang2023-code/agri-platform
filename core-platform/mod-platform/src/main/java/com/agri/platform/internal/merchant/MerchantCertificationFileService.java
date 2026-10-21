package com.agri.platform.internal.merchant;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 企业认证材料文件存储。
 *
 * <p>文件名由服务端生成，目录按主体隔离；数据库只保存本服务生成的下载地址。
 * 企业认证材料包含身份证照片，因此读取链路必须由调用方先完成登录与归属校验。</p>
 */
@Service
public class MerchantCertificationFileService {

    public static final long MAX_IMAGE_BYTES = 5L * 1024 * 1024;

    public static final String BUSINESS_LICENSE = "business_license";
    public static final String LEGAL_PERSON_ID_FRONT = "legal_person_id_front";
    public static final String LEGAL_PERSON_ID_BACK = "legal_person_id_back";

    private static final Pattern SAFE_MERCHANT_ID = Pattern.compile("^[1-9]\\d{0,18}$");
    private static final Pattern SAFE_FILE_ID =
            Pattern.compile("^[a-f0-9]{32}\\.(jpg|png|webp)$");

    private final Path uploadRoot;

    public MerchantCertificationFileService(
            @Value("${agri.platform.certification-upload-dir:uploads/platform/certification}")
            String uploadDir) {
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    /** 保存一张认证材料，返回受控下载地址。 */
    public UploadedFile store(Long merchantId, String kind, MultipartFile file) throws IOException {
        requireMerchantId(merchantId);
        String normalizedKind = normalizeKind(kind);
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择要上传的图片");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "单张图片不能超过 5MB");
        }

        byte[] header;
        try (InputStream input = file.getInputStream()) {
            header = input.readNBytes(12);
        }
        ImageType imageType = ImageType.detect(header);
        if (imageType == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "仅支持 JPG、PNG、WEBP 图片");
        }

        String fileId = UUID.randomUUID().toString().replace("-", "") + imageType.extension;
        Path merchantDirectory = merchantDirectory(merchantId);
        Files.createDirectories(merchantDirectory);
        Path target = merchantDirectory.resolve(fileId).normalize();
        if (!target.startsWith(merchantDirectory)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "非法文件路径");
        }
        try (InputStream input = file.getInputStream()) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return new UploadedFile(downloadUrl(merchantId, normalizedKind, fileId), fileId, normalizedKind);
    }

    /** 校验数据库中的地址确由本服务生成、文件存在且属于该主体。 */
    public String requireOwnedUrl(Long merchantId, String kind, String url) {
        requireMerchantId(merchantId);
        String normalizedKind = normalizeKind(kind);
        if (url == null || url.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, requiredMessage(normalizedKind));
        }
        String prefix = downloadPrefix(merchantId, normalizedKind);
        if (!url.startsWith(prefix)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "认证材料地址无效，请重新上传");
        }
        String fileId = url.substring(prefix.length());
        load(merchantId, normalizedKind, fileId);
        return url;
    }

    /** 读取材料文件；调用方必须先校验当前用户有权访问该主体。 */
    public Resource load(Long merchantId, String kind, String fileId) {
        requireMerchantId(merchantId);
        normalizeKind(kind);
        if (fileId == null || !SAFE_FILE_ID.matcher(fileId).matches()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "认证材料不存在");
        }
        Path merchantDirectory = merchantDirectory(merchantId);
        Path target = merchantDirectory.resolve(fileId).normalize();
        if (!target.startsWith(merchantDirectory) || !Files.isRegularFile(target)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "认证材料不存在");
        }
        return new FileSystemResource(target);
    }

    public String mediaType(String fileId) {
        if (fileId == null) {
            return "application/octet-stream";
        }
        if (fileId.endsWith(".png")) {
            return "image/png";
        }
        if (fileId.endsWith(".webp")) {
            return "image/webp";
        }
        return "image/jpeg";
    }

    private Path merchantDirectory(Long merchantId) {
        return uploadRoot.resolve(String.valueOf(merchantId)).normalize();
    }

    private String downloadPrefix(Long merchantId, String kind) {
        return "/api/v1/sso/account/businesses/" + merchantId
                + "/certification-files/" + kind + "/";
    }

    private String downloadUrl(Long merchantId, String kind, String fileId) {
        return downloadPrefix(merchantId, kind) + fileId;
    }

    private static void requireMerchantId(Long merchantId) {
        if (merchantId == null || !SAFE_MERCHANT_ID.matcher(String.valueOf(merchantId)).matches()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "经营主体编号无效");
        }
    }

    private static String normalizeKind(String kind) {
        String value = kind == null ? "" : kind.trim().toLowerCase(Locale.ROOT);
        if (!Arrays.asList(BUSINESS_LICENSE, LEGAL_PERSON_ID_FRONT, LEGAL_PERSON_ID_BACK).contains(value)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "认证材料类型无效");
        }
        return value;
    }

    private static String requiredMessage(String kind) {
        return switch (kind) {
            case BUSINESS_LICENSE -> "请上传营业执照照片";
            case LEGAL_PERSON_ID_FRONT -> "请上传法人身份证人像面照片";
            case LEGAL_PERSON_ID_BACK -> "请上传法人身份证国徽面照片";
            default -> "请上传认证材料";
        };
    }

    public record UploadedFile(String url, String fileId, String kind) {
    }

    private enum ImageType {
        JPEG(".jpg"),
        PNG(".png"),
        WEBP(".webp");

        private final String extension;

        ImageType(String extension) {
            this.extension = extension;
        }

        private static ImageType detect(byte[] header) {
            if (header == null) {
                return null;
            }
            if (header.length >= 3
                    && (header[0] & 0xff) == 0xff
                    && (header[1] & 0xff) == 0xd8
                    && (header[2] & 0xff) == 0xff) {
                return JPEG;
            }
            if (header.length >= 8
                    && (header[0] & 0xff) == 0x89
                    && header[1] == 0x50
                    && header[2] == 0x4e
                    && header[3] == 0x47
                    && header[4] == 0x0d
                    && header[5] == 0x0a
                    && header[6] == 0x1a
                    && header[7] == 0x0a) {
                return PNG;
            }
            if (header.length >= 12
                    && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                    && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P') {
                return WEBP;
            }
            return null;
        }
    }
}
