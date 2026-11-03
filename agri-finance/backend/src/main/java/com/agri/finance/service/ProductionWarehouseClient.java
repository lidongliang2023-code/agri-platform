package com.agri.finance.service;

import com.agri.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * 生产域只读客户端（仓单链路的数据源）。
 *
 * <p>仓单的货品、数量、仓库、溯源码、区块链存证与仓储监控读数都在生产管理模块，
 * 金融不复制一份、也不直连它的库：<b>带调用方自己的令牌</b>去调 ——
 * 生产侧按令牌解析经营主体，所以"能查到这个批次"本身就等价于"批次确实是你名下的"。
 * 换成服务账号会把这层隔离抹平，因此这里没有"内部令牌"通道。</p>
 *
 * <p>失败口径：生产域不可达一律抛错（fail closed），不静默返回空列表 ——
 * 空列表在页面上长得和"你没有可质押的批次"一模一样。</p>
 */
@Slf4j
@Service
public class ProductionWarehouseClient {

    /**
     * 采收批次（仓单的来源）。
     *
     * <p>{@code userId} 是生产域回包里的 {@code tenantId}：本平台的租户就是经营主体，
     * 两边同一个号只是不同模块的不同叫法。金融侧拿它二次核对"批次确实是这个主体的"。</p>
     */
    public record BatchView(String batchId, String batchNo, String userId, String farmId, String plotId,
                            String plotName, String farmName, String cropName, String cropVariety, String grade,
                            BigDecimal quantity, String unit, Integer status, Integer inboundStatus,
                            String traceCode, String warehouseName, String harvestDate) {
    }

    /** 批次库存（可质押量的口径）。 */
    public record InventoryView(String inventoryId, String batchNo, String warehouseName, String locationCode,
                                BigDecimal currentQty, BigDecimal frozenQty, String unit, String productName,
                                String grade, String expireDate) {
    }

    /** 区块链存证。 */
    public record ChainView(String recordNo, String txHash, String dataHash, String status, String chainType) {
    }

    /** 物联网设备。 */
    public record DeviceView(String deviceId, String deviceCode, String deviceName, String farmId, String plotId,
                             Integer onlineStatus) {
    }

    /** 设备最新读数。 */
    public record SensorView(String deviceId, String deviceCode, String sensorType, String sensorName,
                             BigDecimal value, String unit, String dataTime, String qualityFlag) {
    }

    /** 生产域告警（仓储风险提示）。 */
    public record AlertView(String alertId, String alertCode, String alertType, String title, String content,
                           String level, String status, String sourceName, String triggeredAt) {
    }

    private final RestTemplate restTemplate;
    private final String productionUrl;

    public ProductionWarehouseClient(@Value("${services.production.url:}") String productionUrl,
                                     @Value("${agri.production-client.connect-timeout-ms:3000}") int connectTimeoutMs,
                                     @Value("${agri.production-client.read-timeout-ms:15000}") int readTimeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(factory);
        this.productionUrl = productionUrl;
    }

    public boolean configured() {
        return productionUrl != null && !productionUrl.isBlank();
    }

    /**
     * 批次详情。
     *
     * @return 查不到返回 null（批次不存在，或不属于当前令牌解析出的主体）
     * @throws BusinessException 生产域报身份/配置类错误时如实抛出，不伪装成"没有这个批次"
     */
    public BatchView batch(String batchId) {
        Envelope envelope = call(HttpMethod.GET, "/harvests/{batchId}", null, Map.of("batchId", batchId));
        if (!envelope.success()) {
            explainFailure("采收批次", envelope);
            return null;
        }
        return toBatch(envelope.data());
    }

    /** 当前主体已入库的批次（开仓单的候选）。 */
    public List<BatchView> inboundBatches() {
        Envelope envelope = call(HttpMethod.GET, "/harvests?pageNum=1&pageSize=100&inboundStatus=1", null,
                Map.of());
        if (!envelope.success()) {
            explainFailure("采收批次列表", envelope);
            return List.of();
        }
        List<BatchView> batches = new ArrayList<>();
        for (Map<?, ?> row : recordsOf(envelope.data())) {
            BatchView batch = toBatch(row);
            if (batch != null) {
                batches.add(batch);
            }
        }
        return batches;
    }

    public List<InventoryView> inventory(String batchNo) {
        Envelope envelope = call(HttpMethod.GET, "/harvests/inventory?batchNo={batchNo}", null,
                Map.of("batchNo", batchNo));
        if (!envelope.success()) {
            explainFailure("批次库存", envelope);
            return List.of();
        }
        List<InventoryView> rows = new ArrayList<>();
        for (Map<?, ?> row : recordsOf(envelope.data())) {
            rows.add(new InventoryView(text(row.get("inventoryId")), text(row.get("batchNo")),
                    text(row.get("warehouseName")), text(row.get("locationCode")),
                    decimal(row.get("currentQty")), decimal(row.get("frozenQty")), text(row.get("unit")),
                    text(row.get("productName")), text(row.get("grade")), text(row.get("expireDate"))));
        }
        return rows;
    }

    /** 取批次最近一次成功上链的哈希；没有成功记录返回 null（仓单上如实显示"未存证"）。 */
    public ChainView harvestChainRecord(String batchNo) {
        Envelope envelope = call(HttpMethod.GET, "/blockchain/by-biz?bizType={type}&bizNo={batchNo}", null,
                Map.of("type", "HARVEST", "batchNo", batchNo));
        if (!envelope.success()) {
            explainFailure("采收存证", envelope);
            return null;
        }
        if (!(envelope.data() instanceof List<?> list)) {
            return null;
        }
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> row)) {
                continue;
            }
            ChainView chain = new ChainView(text(row.get("recordNo")), text(row.get("txHash")),
                    text(row.get("dataHash")), text(row.get("status")), text(row.get("chainType")));
            if ("SUCCESS".equalsIgnoreCase(String.valueOf(chain.status())) && chain.txHash() != null) {
                return chain;
            }
        }
        return null;
    }

    /**
     * 本批次名下的设备（按地块优先、农场兜底）。
     *
     * <p>筛不到就返回空列表，<b>不退回"全部设备"</b>：把别的农场的读数当本批次的仓储温度，
     * 是"接口 200、页面不报错、数字是错的"那一类问题。要不要退让由调用方决定，并且必须留说明。</p>
     */
    public List<DeviceView> devices(String farmId, String plotId) {
        List<DeviceView> all = allDevices();
        if (plotId != null && !plotId.isBlank()) {
            List<DeviceView> matched = all.stream().filter(item -> plotId.equals(item.plotId())).toList();
            if (!matched.isEmpty()) {
                return matched;
            }
        }
        if (farmId != null && !farmId.isBlank()) {
            return all.stream().filter(item -> farmId.equals(item.farmId())).toList();
        }
        return List.of();
    }

    /** 当前主体名下的全部设备（生产侧按令牌解析租户，所以这里不会漏到别人家）。 */
    public List<DeviceView> allDevices() {
        Envelope envelope = call(HttpMethod.GET, "/iot/devices?pageNum=1&pageSize=200", null, Map.of());
        if (!envelope.success()) {
            explainFailure("物联网设备台账", envelope);
            return List.of();
        }
        List<DeviceView> all = new ArrayList<>();
        for (Map<?, ?> row : recordsOf(envelope.data())) {
            all.add(new DeviceView(text(row.get("deviceId")), text(row.get("deviceCode")),
                    text(row.get("deviceName")), text(row.get("farmId")), text(row.get("plotId")),
                    integer(row.get("onlineStatus"))));
        }
        return all;
    }

    public List<SensorView> latestSensors(Collection<String> deviceIds) {
        List<Long> ids = new ArrayList<>();
        for (String deviceId : deviceIds) {
            Long parsed = aLong(deviceId);
            if (parsed != null) {
                ids.add(parsed);
            }
        }
        if (ids.isEmpty()) {
            return List.of();
        }
        Envelope envelope = call(HttpMethod.POST, "/iot/sensor-data/latest", ids, Map.of());
        if (!envelope.success()) {
            explainFailure("设备最新读数", envelope);
            return List.of();
        }
        List<SensorView> readings = new ArrayList<>();
        if (envelope.data() instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> row) {
                    readings.add(new SensorView(text(row.get("deviceId")), text(row.get("deviceCode")),
                            text(row.get("sensorType")), text(row.get("sensorName")), decimal(row.get("value")),
                            text(row.get("unit")), text(row.get("dataTime")), text(row.get("qualityFlag"))));
                }
            }
        }
        return readings;
    }

    /** 生产域告警（仓单页的"风险提示"）。 */
    public List<AlertView> alerts() {
        Envelope envelope = call(HttpMethod.GET, "/alerts/records?pageNum=1&pageSize=100", null, Map.of());
        if (!envelope.success()) {
            explainFailure("生产域告警", envelope);
            return List.of();
        }
        List<AlertView> alerts = new ArrayList<>();
        for (Map<?, ?> row : recordsOf(envelope.data())) {
            alerts.add(new AlertView(text(row.get("id")), text(row.get("alertCode")), text(row.get("alertType")),
                    text(row.get("title")), text(row.get("content")), text(row.get("level")),
                    text(row.get("status")), text(row.get("sourceName")), text(row.get("createTime"))));
        }
        return alerts;
    }

    /** 生产域的回包：{@code code==0} 才是成功，成功码是 0 不是 200（与平台一致）。 */
    private record Envelope(int code, String message, Object data) {
        boolean success() {
            return code == 0;
        }
    }

    private Envelope call(HttpMethod method, String path, Object body, Map<String, ?> uriVariables) {
        if (!configured()) {
            throw new BusinessException(503, "未配置生产域地址（services.production.url），无法核对仓单来源");
        }
        String authorization = FinanceIdentityService.currentAuthorization();
        if (authorization == null) {
            throw new BusinessException(401, "未登录：缺少平台访问令牌");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authorization);
        headers.setContentType(MediaType.APPLICATION_JSON);
        try {
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    productionUrl + "/api/v1/production" + path, method,
                    new HttpEntity<>(body, headers),
                    new ParameterizedTypeReference<Map<String, Object>>() {
                    }, uriVariables);
            Map<String, Object> envelope = response.getBody();
            Integer code = envelope == null ? null : integer(envelope.get("code"));
            return new Envelope(code == null ? -1 : code,
                    envelope == null ? null : text(envelope.get("message")),
                    envelope == null ? null : envelope.get("data"));
        } catch (RestClientException e) {
            log.warn("调用生产域失败：{} {}", path, e.getMessage());
            throw new BusinessException(503, "生产域服务暂不可达（" + e.getClass().getSimpleName()
                    + "），仓单需要核对批次与存证，请稍后重试");
        }
    }

    /**
     * 生产域回了非成功码。
     *
     * <p>身份/配置类错误（未登录、没绑主体、平台不可达）必须原样报给调用方：
     * 把它们收敛成"查不到这个批次"会让人去翻生产模块的数据，而真正的问题是登录身份。
     * 其余（参数、找不到）按"查不到"处理，由上层给出仓单口径的原因。</p>
     */
    private void explainFailure(String subject, Envelope envelope) {
        int code = envelope.code();
        if (code == 401 || code == 403 || code == 500 || code == 503) {
            throw new BusinessException(code, "生产域" + subject + "读取失败：" + envelope.message());
        }
        log.info("生产域{}返回非成功码：code={} message={}", subject, code, envelope.message());
    }

    private List<Map<?, ?>> recordsOf(Object data) {
        Object rows = null;
        if (data instanceof List<?> list) {
            rows = list;
        } else if (data instanceof Map<?, ?> map) {
            Object records = map.get("records") != null ? map.get("records") : map.get("list");
            if (records instanceof List<?> list) {
                rows = list;
            }
        }
        if (rows == null) {
            return List.of();
        }
        List<Map<?, ?>> result = new ArrayList<>();
        for (Object item : (List<?>) rows) {
            if (item instanceof Map<?, ?> row) {
                result.add(row);
            }
        }
        return result;
    }

    private BatchView toBatch(Object data) {
        if (!(data instanceof Map<?, ?> row)) {
            return null;
        }
        Object batchId = row.get("batchId");
        if (batchId == null) {
            return null;
        }
        return new BatchView(text(batchId), text(row.get("batchNo")), text(row.get("tenantId")),
                text(row.get("farmId")), text(row.get("plotId")), text(row.get("plotName")),
                text(row.get("farmName")), text(row.get("cropName")), text(row.get("cropVariety")),
                text(row.get("grade")), decimal(row.get("quantity")), text(row.get("unit")),
                integer(row.get("status")), integer(row.get("inboundStatus")), text(row.get("traceCode")),
                text(row.get("warehouseName")), text(row.get("harvestDate")));
    }

    private String text(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Integer integer(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return value == null ? null : Integer.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Long aLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        try {
            return value == null ? null : Long.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private BigDecimal decimal(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return new BigDecimal(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
