package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

/** 病斑样本属于图谱域；只允许已发布样本参与病例图片检索。 */
@Service
public class PestImageService {
    private static final long MAX_BYTES = 5L * 1024 * 1024;
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final Path root;

    public PestImageService(JdbcTemplate db, ObjectMapper json,
            @Value("${production.pest-images.directory:./data/production-pest-images}") String directory) {
        this.db = db;
        this.json = json;
        this.root = Path.of(directory).toAbsolutePath().normalize();
    }

    public record StoredSample(String id, String imageUrl, int width, int height, String imageSha256, String imagePHash) {}

    @Transactional
    public StoredSample create(MultipartFile file, String atlasId, int atlasRevision, String source,
            String sourceVersion, String sourceRef, String note) {
        if (file == null || file.isEmpty()) throw new BusinessException(400, "请选择病斑样本图片");
        if (file.getSize() > MAX_BYTES) throw new BusinessException(413, "病斑样本图片不能超过5MB");
        String requiredSource = text(source, 500, true), requiredVersion = text(sourceVersion, 200, true), requiredRef = text(sourceRef, 500, true);
        Map<String, Object> atlas = atlas(atlasId, atlasRevision);
        String crop = Objects.toString(atlas.get("cropName"), "");
        String disease = Objects.toString(atlas.get("diseaseName"), "");
        ImageData image = read(file);
        String id = UUID.randomUUID().toString();
        String filename = UUID.randomUUID().toString().replace("-", "") + (image.format.equals("png") ? ".png" : ".jpg");
        Path target = root.resolve(filename).normalize();
        try {
            Files.createDirectories(root);
            Files.write(target, image.bytes, StandardOpenOption.CREATE_NEW);
            LocalDateTime now = LocalDateTime.now();
            db.update("INSERT INTO agri_prod_pest_image_sample(id,atlas_id,atlas_revision,sample_revision,crop_name,disease_name,image_url,image_sha256,image_phash,width,height,source,source_version,source_ref,note,status,created_by,created_at,updated_at) VALUES(?,?,?,1,?,?,?,?,?,?,?,?,?,?,?,'DRAFT',?,?,?)",
                    id, atlasId, atlasRevision, crop, disease, "/api/v1/production/pest-images/" + filename,
                    image.sha256, image.phash, image.width, image.height, requiredSource, requiredVersion, requiredRef,
                    text(note, 1000, false), TenantContextService.currentOperator(), now, now);
            Map<String, Object> revisionPayload = new LinkedHashMap<>();
            revisionPayload.put("atlasId", atlasId); revisionPayload.put("atlasRevision", atlasRevision);
            revisionPayload.put("cropName", crop); revisionPayload.put("diseaseName", disease);
            revisionPayload.put("imageUrl", "/api/v1/production/pest-images/" + filename);
            revisionPayload.put("imageSha256", image.sha256); revisionPayload.put("imagePHash", image.phash);
            revisionPayload.put("width", image.width); revisionPayload.put("height", image.height);
            revisionPayload.put("source", requiredSource); revisionPayload.put("sourceVersion", requiredVersion);
            revisionPayload.put("sourceRef", requiredRef); revisionPayload.put("note", text(note, 1000, false));
            db.update("INSERT INTO agri_prod_pest_image_revision(id,revision,status,payload_json,recorded_at) VALUES(?,?,?,?,?)",
                    id, 1, "DRAFT", encode(revisionPayload), now);
            return new StoredSample(id, "/api/v1/production/pest-images/" + filename, image.width, image.height, image.sha256, image.phash);
        } catch (DuplicateKeyException e) {
            deleteQuietly(target);
            throw new BusinessException(409, "该病斑图片已存在，请勿重复录入");
        } catch (IOException e) {
            deleteQuietly(target);
            throw new BusinessException(503, "病斑样本图片存储失败，请稍后重试", e);
        }
    }

    @Transactional
    public Map<String, Object> publish(String id, boolean published) {
        Map<String, Object> row = one(id);
        int next = ((Number) row.get("sample_revision")).intValue() + 1;
        if (published) atlas(String.valueOf(row.get("atlas_id")), ((Number) row.get("atlas_revision")).intValue());
        String status = published ? "PUBLISHED" : "OFFLINE";
        LocalDateTime now = LocalDateTime.now();
        db.update("UPDATE agri_prod_pest_image_sample SET status=?,updated_at=?,published_at=? WHERE id=?", status, now, published ? now : null, id);
        Map<String, Object> payload = new LinkedHashMap<>(row);
        payload.remove("created_at"); payload.remove("updated_at"); payload.remove("published_at");
        db.update("INSERT INTO agri_prod_pest_image_revision(id,revision,status,payload_json,recorded_at) VALUES(?,?,?,?,?)", id, next, status, encode(payload), now);
        return get(id);
    }

    public Map<String, Object> get(String id) { return one(id); }

    public List<Map<String, Object>> list(String atlasId, String status) {
        StringBuilder sql = new StringBuilder("SELECT * FROM agri_prod_pest_image_sample WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (atlasId != null && !atlasId.isBlank()) { sql.append(" AND atlas_id=?"); args.add(atlasId); }
        if (status != null && !status.isBlank()) { sql.append(" AND status=?"); args.add(status); }
        sql.append(" ORDER BY updated_at DESC,id");
        return db.queryForList(sql.toString(), args.toArray());
    }

    /** 对最多3张病例照片分别检索，返回去重后的前6条；相似度只表示图像指纹接近度。 */
    public Map<String, Object> search(String cropName, List<String> images) {
        String crop = cropName == null ? "" : cropName.trim();
        List<Map<String, Object>> samples = db.queryForList("SELECT s.*,a.payload_json atlas_payload FROM agri_prod_pest_image_sample s JOIN agri_prod_pest_atlas a ON a.id=s.atlas_id AND a.revision=s.atlas_revision AND a.status='PUBLISHED' WHERE s.status='PUBLISHED'", new Object[]{});
        List<Map<String, Object>> matches = new ArrayList<>();
        for (String data : images == null ? List.<String>of() : images) {
            try {
                byte[] bytes = decodeDataUrl(data);
                String hash = averageHash(ImageIO.read(new ByteArrayInputStream(bytes)));
                for (Map<String, Object> sample : samples) {
                    Map<String, Object> atlas = decode(String.valueOf(sample.get("atlas_payload")));
                    if (!sameCrop(crop, atlas)) continue;
                    String sampleHash = String.valueOf(sample.get("image_phash"));
                    int distance = hamming(hash, sampleHash);
                    Map<String, Object> hit = new LinkedHashMap<>();
                    hit.put("sampleId", sample.get("id")); hit.put("atlasId", sample.get("atlas_id"));
                    hit.put("revision", sample.get("revision")); hit.put("cropName", sample.get("crop_name"));
                    hit.put("diseaseName", sample.get("disease_name")); hit.put("imageUrl", sample.get("image_url"));
                    hit.put("distance", distance); hit.put("similarity", Math.round((1d - distance / 64d) * 1000d) / 1000d);
                    hit.put("source", sample.get("source")); hit.put("sourceVersion", sample.get("source_version")); hit.put("sourceRef", sample.get("source_ref"));
                    matches.add(hit);
                }
            } catch (Exception ignored) { }
        }
        Map<String, Map<String, Object>> best = new LinkedHashMap<>();
        for (Map<String, Object> hit : matches) best.merge(String.valueOf(hit.get("sampleId")), hit,
                (a, b) -> ((Number) a.get("distance")).intValue() <= ((Number) b.get("distance")).intValue() ? a : b);
        List<Map<String, Object>> top = new ArrayList<>(best.values());
        top.sort(Comparator.comparingInt(x -> ((Number) x.get("distance")).intValue()));
        if (top.size() > 6) top = new ArrayList<>(top.subList(0, 6));
        return Map.of("status", top.isEmpty() ? "NO_MATCH" : "MATCHED", "method", "PERCEPTUAL_HASH_AHASH_V1",
                "references", top, "notice", "图片指纹相似度仅用于检索候选，不是诊断置信度；需结合现场症状、图谱证据和人工核验。");
    }

    public Path requireImage(String name) {
        if (name == null || !name.matches("[a-f0-9]{32}\\.(png|jpg)")) throw new BusinessException(404, "病斑样本不存在");
        Path path = root.resolve(name).normalize();
        if (!path.getParent().equals(root) || !Files.isRegularFile(path)) throw new BusinessException(404, "病斑样本不存在");
        return path;
    }

    private Map<String, Object> atlas(String id, int revision) {
        List<Map<String, Object>> rows = db.queryForList("SELECT id,revision,status,payload_json FROM agri_prod_pest_atlas WHERE id=?", id);
        if (rows.isEmpty()) throw new BusinessException(404, "关联图谱不存在");
        Map<String, Object> row = rows.get(0);
        if (!"PUBLISHED".equals(row.get("status")) || ((Number) row.get("revision")).intValue() != revision)
            throw new BusinessException(409, "样本必须绑定当前已发布的图谱修订");
        return decode(String.valueOf(row.get("payload_json")));
    }

    private Map<String, Object> one(String id) {
        List<Map<String, Object>> rows = db.queryForList("SELECT * FROM agri_prod_pest_image_sample WHERE id=?", id);
        if (rows.isEmpty()) throw new BusinessException(404, "病斑样本不存在");
        return rows.get(0);
    }

    private static boolean sameCrop(String requested, Map<String, Object> atlas) {
        if (requested.isBlank()) return false;
        if (requested.equals(String.valueOf(atlas.get("cropName")))) return true;
        Object aliases = atlas.get("cropAliases");
        return aliases instanceof List<?> list && list.stream().anyMatch(x -> requested.equals(String.valueOf(x)));
    }

    private static ImageData read(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null || image.getWidth() < 32 || image.getHeight() < 32 || (long) image.getWidth() * image.getHeight() > 25000000L)
                throw new BusinessException(400, "样本图片无效，边长至少32像素且不超过2500万像素");
            String type = Optional.ofNullable(file.getContentType()).orElse("");
            if (!Set.of("image/jpeg", "image/png").contains(type)) throw new BusinessException(400, "仅支持JPEG或PNG病斑图片");
            String format = "image/png".equals(type) ? "png" : "jpg";
            return new ImageData(bytes, image.getWidth(), image.getHeight(), format, sha256(bytes), averageHash(image));
        } catch (IOException e) { throw new BusinessException(400, "样本图片损坏，请重新上传", e); }
    }

    private record ImageData(byte[] bytes, int width, int height, String format, String sha256, String phash) {}
    private static String averageHash(BufferedImage image) {
        if (image == null) throw new BusinessException(400, "图片无法读取");
        BufferedImage small = new BufferedImage(8, 8, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = small.createGraphics(); g.drawImage(image, 0, 0, 8, 8, null); g.dispose();
        int[] values = new int[64]; int sum = 0;
        for (int y=0;y<8;y++) for (int x=0;x<8;x++) { values[y*8+x] = small.getRaster().getSample(x,y,0); sum += values[y*8+x]; }
        int avg = sum / 64; long bits = 0L;
        for (int i=0;i<64;i++) if (values[i] >= avg) bits |= (1L << i);
        return String.format("%016x", bits);
    }
    private static int hamming(String a, String b) { return Long.bitCount(Long.parseUnsignedLong(a, 16) ^ Long.parseUnsignedLong(b, 16)); }
    private static byte[] decodeDataUrl(String value) { if (value == null || !value.startsWith("data:image/")) throw new IllegalArgumentException(); int comma=value.indexOf(','); return Base64.getDecoder().decode(value.substring(comma+1)); }
    private static String sha256(byte[] bytes) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); } catch(Exception e) { throw new IllegalStateException(e); } }
    private String encode(Object value) { try { return json.writeValueAsString(value); } catch(Exception e) { throw new IllegalStateException(e); } }
    private Map<String,Object> decode(String value) { try { return json.readValue(value, new TypeReference<LinkedHashMap<String,Object>>(){}); } catch(Exception e) { throw new IllegalStateException(e); } }
    private static String text(String value,int max,boolean required) { String s=value==null?"":value.trim(); if ((required&&s.isBlank())||s.length()>max) throw new BusinessException(400,"样本字段缺失或超出长度限制"); return s; }
    private static void deleteQuietly(Path path) { try { Files.deleteIfExists(path); } catch(IOException ignored) {} }
}
