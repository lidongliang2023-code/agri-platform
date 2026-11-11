package com.agri.core.masterdata;

import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.product.ProductEntity;
import com.agri.platform.internal.product.ProductMapper;
import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.produce.internal.farm.FarmInfoMapper;
import com.agri.produce.internal.input.SupplierEntity;
import com.agri.produce.internal.input.SupplierMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * 主数据分发接收端：只维护平台域、生产域的本地投影。
 * 主数据中心仍是权威源；幂等登记、投影落库和最终回执状态分别在明确的事务边界内完成。
 */
@Service
public class MasterDataReceiveService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final MerchantMapper merchantMapper;
    private final ProductMapper productMapper;
    private final FarmInfoMapper farmInfoMapper;
    private final SupplierMapper supplierMapper;
    private final TransactionTemplate tx;

    public MasterDataReceiveService(JdbcTemplate jdbc, ObjectMapper objectMapper,
                                    MerchantMapper merchantMapper, ProductMapper productMapper,
                                    FarmInfoMapper farmInfoMapper, SupplierMapper supplierMapper,
                                    PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.merchantMapper = merchantMapper;
        this.productMapper = productMapper;
        this.farmInfoMapper = farmInfoMapper;
        this.supplierMapper = supplierMapper;
        this.tx = new TransactionTemplate(transactionManager);
    }

    public record ReceiveRequest(String taskId, String tenantId, String dataType,
                                 Integer schemaVersion, String idempotencyKey, JsonNode records) {}

    public record ReceiveAck(boolean success, String idempotencyKey, String receiptId,
                             int acceptedCount, String message) {}

    public ReceiveAck receive(ReceiveRequest request) {
        validate(request);
        long coreTenantId = resolveTenant(request.tenantId());
        String receiptId = "MDR-" + UUID.randomUUID();
        boolean owner = Boolean.TRUE.equals(tx.execute(status -> jdbc.update(
                "INSERT IGNORE INTO platform_master_data_receipt "
                        + "(id,receipt_id,idempotency_key,source_task_id,data_type,tenant_code,core_tenant_id,accepted_count,receive_status,receive_message) "
                        + "VALUES (?,?,?,?,?,?,?,0,'processing',NULL)",
                IdWorker.getId(), receiptId, request.idempotencyKey(), request.taskId(), request.dataType(),
                request.tenantId(), coreTenantId) == 1));

        if (!owner) return awaitExisting(request.idempotencyKey());

        try {
            Integer accepted = tx.execute(status -> {
                int count = apply(request.dataType(), request.records(), coreTenantId);
                jdbc.update("UPDATE platform_master_data_receipt SET accepted_count=?,receive_status='success',receive_message=? "
                                + "WHERE idempotency_key=?",
                        count, "主数据投影已落库", request.idempotencyKey());
                return count;
            });
            return new ReceiveAck(true, request.idempotencyKey(), receiptId, accepted == null ? 0 : accepted, "主数据投影已落库");
        } catch (RuntimeException ex) {
            // 投影事务已回滚；失败状态单独落库，重复投递不会永久等待或误报成功。
            String message = ex.getMessage() == null ? "主数据投影失败" : ex.getMessage();
            tx.executeWithoutResult(status -> jdbc.update(
                    "UPDATE platform_master_data_receipt SET receive_status='failed',receive_message=? WHERE idempotency_key=?",
                    message.substring(0, Math.min(500, message.length())), request.idempotencyKey()));
            throw ex;
        }
    }

    private ReceiveAck awaitExisting(String idempotencyKey) {
        for (int attempt = 0; attempt < 40; attempt++) {
            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT receipt_id,accepted_count,receive_status,receive_message FROM platform_master_data_receipt WHERE idempotency_key=?",
                    idempotencyKey);
            String state = String.valueOf(row.get("receive_status"));
            if ("success".equals(state)) {
                return new ReceiveAck(true, idempotencyKey, String.valueOf(row.get("receipt_id")),
                        ((Number) row.get("accepted_count")).intValue(), "重复投递，返回原持久化回执");
            }
            if ("failed".equals(state)) {
                throw new BusinessException(ErrorCode.BIZ_ERROR, String.valueOf(row.get("receive_message")));
            }
            try { Thread.sleep(50L); }
            catch (InterruptedException ex) { Thread.currentThread().interrupt();
                throw new BusinessException(ErrorCode.CONFLICT, "等待原始投递结果时被中断"); }
        }
        throw new BusinessException(ErrorCode.CONFLICT, "原始投递仍在处理中，请稍后使用相同幂等键查询");
    }

    private int apply(String dataType, JsonNode records, long tenantId) {
        int accepted = 0;
        for (JsonNode record : records) {
            if (record == null || !record.isObject()) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "主数据记录必须是对象");
            }
            switch (dataType.toLowerCase(Locale.ROOT)) {
                case "merchant", "customer", "supplier" -> upsertMerchant(record, tenantId);
                case "product", "goods" -> upsertProduct(record, tenantId);
                case "farm", "farm_info" -> upsertFarm(record, tenantId);
                case "input_supplier", "produce_supplier" -> upsertSupplier(record, tenantId);
                default -> throw new BusinessException(ErrorCode.BAD_REQUEST, "核心平台暂不接收该主数据类型：" + dataType);
            }
            accepted++;
        }
        return accepted;
    }

    private void upsertMerchant(JsonNode n, long tenantId) {
        String code = required(n, "code", "merchantCode", "customerCode", "supplierCode");
        MerchantEntity e = merchantMapper.selectOne(new LambdaQueryWrapper<MerchantEntity>()
                .eq(MerchantEntity::getCode, code).eq(MerchantEntity::getTenantId, tenantId).last("LIMIT 1"));
        if (e == null) e = new MerchantEntity();
        e.setCode(code); e.setName(required(n, "name", "merchantName", "customerName", "supplierName"));
        e.setType(text(n, "type", "merchantType", "customerType", "supplierType", "BOTH"));
        e.setCreditCode(text(n, "creditCode", "licenseNo", null));
        e.setContactName(text(n, "contactName", "contactPerson", null));
        e.setContactPhone(text(n, "contactPhone", "phone", null));
        e.setStatus(integer(n, "status", 1)); e.setTenantId(tenantId); e.setMarketId(longValue(n, "marketId", 1L));
        if (e.getId() == null) merchantMapper.insert(e); else merchantMapper.updateById(e);
    }

    private void upsertProduct(JsonNode n, long tenantId) {
        String code = required(n, "code", "productCode", "goodsCode");
        ProductEntity e = productMapper.selectOne(new LambdaQueryWrapper<ProductEntity>()
                .eq(ProductEntity::getCode, code).eq(ProductEntity::getTenantId, tenantId).last("LIMIT 1"));
        if (e == null) e = new ProductEntity();
        e.setCode(code); e.setName(required(n, "name", "productName", "goodsName"));
        e.setSpec(text(n, "spec", "specification", null)); e.setUnit(text(n, "unit", null));
        e.setCategoryId(longNode(n, "categoryId")); e.setMerchantId(longNode(n, "merchantId"));
        e.setPrice(decimal(n, "price")); e.setStock(decimal(n, "stock", "quantity"));
        e.setStatus(integer(n, "status", 1)); e.setTenantId(tenantId); e.setMarketId(longValue(n, "marketId", 1L));
        if (e.getId() == null) productMapper.insert(e); else productMapper.updateById(e);
    }

    private void upsertFarm(JsonNode n, long tenantId) {
        String code = required(n, "farmCode", "code");
        FarmInfoEntity e = farmInfoMapper.selectOne(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getFarmCode, code).eq(FarmInfoEntity::getTenantId, tenantId).last("LIMIT 1"));
        if (e == null) {
            e = new FarmInfoEntity();
            e.setFarmId(text(n, "farmId", "id", code));
        }
        e.setFarmCode(code);
        e.setFarmName(required(n, "farmName", "name")); e.setFarmType(integer(n, "farmType", 1));
        e.setProvince(text(n, "province", null)); e.setCity(text(n, "city", null)); e.setDistrict(text(n, "district", null));
        e.setAddress(text(n, "address", null)); e.setManagerName(text(n, "managerName", "contactName", null));
        e.setManagerPhone(text(n, "managerPhone", "contactPhone", null)); e.setStatus(integer(n, "status", 1));
        e.setTenantId(tenantId); e.setMarketId(longValue(n, "marketId", 1L));
        if (e.getFarmId() == null || e.getFarmId().isBlank()) e.setFarmId(code);
        if (farmInfoMapper.selectById(e.getFarmId()) == null) farmInfoMapper.insert(e); else farmInfoMapper.updateById(e);
    }

    private void upsertSupplier(JsonNode n, long tenantId) {
        String code = required(n, "supplierCode", "code");
        SupplierEntity e = supplierMapper.selectOne(new LambdaQueryWrapper<SupplierEntity>()
                .eq(SupplierEntity::getSupplierCode, code).eq(SupplierEntity::getTenantId, tenantId).last("LIMIT 1"));
        boolean isNew = e == null;
        if (isNew) {
            e = new SupplierEntity();
            // 上游 supplierId 只用于新增；更新必须保持本地业务主键不变，
            // 否则会把同一供应商更新成新行，破坏本地关联的投入品与溯源记录。
            e.setSupplierId(text(n, "supplierId", "id", code));
            if (e.getSupplierId() == null || e.getSupplierId().isBlank()) e.setSupplierId(code);
        }
        e.setSupplierCode(code);
        e.setSupplierName(required(n, "supplierName", "name")); e.setContactName(text(n, "contactName", null));
        e.setContactPhone(text(n, "contactPhone", "phone", null)); e.setLicenseNo(text(n, "licenseNo", "creditCode", null));
        e.setAddress(text(n, "address", null)); e.setCreditLevel(text(n, "creditLevel", null)); e.setStatus(integer(n, "status", 1));
        e.setTenantId(tenantId); e.setMarketId(longValue(n, "marketId", 1L));
        if (isNew) supplierMapper.insert(e); else supplierMapper.updateById(e);
    }

    private long resolveTenant(String tenantCode) {
        Long id = jdbc.query("SELECT core_tenant_id FROM platform_master_data_tenant_mapping WHERE tenant_code=? AND status=1",
                ps -> ps.setString(1, tenantCode), rs -> rs.next() ? rs.getLong(1) : null);
        if (id == null) throw new BusinessException(ErrorCode.BAD_REQUEST, "未配置主数据租户映射：" + tenantCode);
        return id;
    }

    private void validate(ReceiveRequest r) {
        if (r == null || blank(r.taskId()) || blank(r.tenantId()) || blank(r.dataType()) || blank(r.idempotencyKey())
                || r.records() == null || !r.records().isArray() || r.records().isEmpty() || r.records().size() > 1000) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "主数据接收请求不完整");
        }
        if (r.idempotencyKey().length() > 64 || r.dataType().length() > 50)
            throw new BusinessException(ErrorCode.BAD_REQUEST, "主数据接收请求字段过长");
    }

    private boolean blank(String s) { return s == null || s.isBlank(); }
    private String required(JsonNode n, String... keys) {
        String value = text(n, keys);
        if (blank(value)) throw new BusinessException(ErrorCode.BAD_REQUEST, "主数据缺少必填字段：" + keys[0]);
        return value;
    }
    private String text(JsonNode n, String... keys) {
        if (keys == null) return null;
        for (String key : keys) if (key != null && n.hasNonNull(key) && !n.get(key).asText().isBlank()) return n.get(key).asText();
        return null;
    }
    private Integer integer(JsonNode n, String key, int fallback) { return n.hasNonNull(key) ? n.get(key).asInt() : fallback; }
    private Long longNode(JsonNode n, String key) { return n.hasNonNull(key) ? n.get(key).asLong() : null; }
    private long longValue(JsonNode n, String key, long fallback) { return n.hasNonNull(key) ? n.get(key).asLong() : fallback; }
    private BigDecimal decimal(JsonNode n, String... keys) {
        String v = text(n, keys); return blank(v) ? null : new BigDecimal(v);
    }
}
