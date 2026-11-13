package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Iterator;
import java.util.Locale;
import java.util.UUID;

/** 知识文章与 SOP 共用的正文图片存储，独立于证照和业务附件。 */
@Service
public class ContentImageService {
    public static final long MAX_BYTES = 5L * 1024 * 1024;
    private final Path root;
    public ContentImageService(@Value("${production.content-images.directory:./data/production-content-images}") String directory) {
        root = Path.of(directory).toAbsolutePath().normalize();
    }
    public record StoredImage(String url, int width, int height, long size) {}
    public StoredImage store(MultipartFile file) {
        if (file == null) throw new BusinessException(400, "请选择要上传的图片");
        if (file.isEmpty()) throw new BusinessException(400, "图片文件为空，请重新选择");
        if (file.getSize() > MAX_BYTES) throw new BusinessException(413, "单张图片不能超过5MB，请压缩后上传");
        String mime = file.getContentType();
        if (!"image/png".equals(mime) && !"image/jpeg".equals(mime)) throw new BusinessException(400, "仅支持PNG、JPEG图片");
        try (var stream = file.getInputStream()) {
            byte[] bytes = stream.readNBytes((int) MAX_BYTES + 1);
            if (bytes.length > MAX_BYTES) throw new BusinessException(413, "单张图片不能超过5MB，请压缩后上传");
            try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw new BusinessException(400, "文件不是有效图片");
                ImageReader reader = readers.next();
                try {
                    String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                    if (!("png".equals(format) || "jpeg".equals(format))) throw new BusinessException(400, "仅支持PNG、JPEG图片");
                    if (!("png".equals(format) ? "image/png" : "image/jpeg").equals(mime)) throw new BusinessException(400, "图片类型与文件内容不一致");
                    reader.setInput(input, true, true);
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width < 1 || height < 1 || width > 10000 || height > 10000 || (long) width * height > 25000000) throw new BusinessException(400, "图片尺寸超过限制（最大10000边长、2500万像素）");
                    BufferedImage image = reader.read(0);
                    ByteArrayOutputStream output = new ByteArrayOutputStream();
                    if (!ImageIO.write(image, format, output)) throw new BusinessException(400, "图片无法处理");
                    if (output.size() > MAX_BYTES) throw new BusinessException(413, "图片处理后超过5MB，请压缩后上传");
                    String name = UUID.randomUUID().toString().replace("-", "") + ("png".equals(format) ? ".png" : ".jpg");
                    try {
                        Files.createDirectories(root);
                        Files.write(root.resolve(name), output.toByteArray(), StandardOpenOption.CREATE_NEW);
                    } catch (IOException | SecurityException ex) {
                        throw new BusinessException(503, "图片存储服务暂不可用，请稍后重试；正文内容已保留", ex);
                    }
                    return new StoredImage("/api/v1/production/knowledge-images/" + name, width, height, output.size());
                } finally { reader.dispose(); }
            }
        } catch (IOException ex) { throw new BusinessException(400, "图片损坏或无法读取，请重新导出为PNG或JPEG后上传", ex); }
    }
    public Path requireImage(String name) {
        if (name == null || !name.matches("[a-f0-9]{32}\\.(png|jpg)")) throw new BusinessException(404, "图片不存在");
        Path path = root.resolve(name).normalize();
        if (!path.getParent().equals(root) || !Files.isRegularFile(path)) throw new BusinessException(404, "图片不存在");
        return path;
    }
}
