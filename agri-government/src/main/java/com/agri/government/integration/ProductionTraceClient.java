package com.agri.government.integration;

import com.agri.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 溯源核验的跨域取数：读**生产域**的真实溯源码与链上存证。
 *
 * <p>架构口径（V2.0）：跨域取数走接口，不开别人库的连接。政府域以前核验一条码，
 * 读的是自己库里的 {@code gov_trace_event} 种子表（5 行写死的"种植/采收/加工/流通/销售"），
 * 也就是说监管页面上的"区块链核验通过"跟生产域真实发生了什么毫无关系。</p>
 *
 * <p>取数走生产域的公开核验入口
 * {@code GET /api/v1/production/trace/public/verify/{code}} —— 它刻意跨主体：
 * 核验时手上只有码，没有属主令牌（公众与执法端都没有）。</p>
 *
 * <p><b>不可达时不猜</b>：生产域取不到就是取不到，抛 503 让页面明确报错；
 * 绝不退回种子表、也绝不把"没查到"显示成"核验通过"。</p>
 */
@Slf4j
@Component
public class ProductionTraceClient {

    private static final String VERIFY_PATH = "/api/v1/production/trace/public/verify/";

    @Value("${agri.production.url:http://localhost:8092}")
    private String productionUrl;

    private final ObjectMapper objectMapper = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .build();

    /** 一次核验的产物：结论字段 + 已按监管页面整理好的时间线。 */
    public record Verification(Map<String, Object> raw, List<Map<String, Object>> events,
                              int nodeCount, long onChainCount, long attestedCount, String conclusion) {
    }

    /**
     * 按溯源码核验。
     *
     * @return 核验结果（节点时间线按监管页面的形状整理好）
     * @throws BusinessException 404 = 码不存在或已作废；503 = 生产域不可达/返回异常
     */
    public Verification verify(String code) {
        if (code == null || code.isBlank()) {
            throw BusinessException.validationError("请输入溯源码");
        }
        String key = code.trim();
        JsonNode data;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(productionUrl + VERIFY_PATH + enc(key)))
                    .timeout(Duration.ofSeconds(5))
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode root = objectMapper.readTree(response.body());
            int bodyCode = root.path("code").asInt(-1);
            if (response.statusCode() == 404 || bodyCode == 404) {
                throw BusinessException.notFound(root.path("message").asText("溯源码不存在：" + key));
            }
            if (response.statusCode() != 200 || (bodyCode != 0 && bodyCode != 200)) {
                throw new BusinessException(503, "生产域溯源核验服务返回异常（HTTP " + response.statusCode()
                        + " code=" + bodyCode + "），没有给出结论：" + root.path("message").asText(""));
            }
            data = root.path("data");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.warn("生产域溯源核验不可达：{}", e.getMessage());
            throw new BusinessException(503, "生产域溯源核验服务暂不可达，无法核验该溯源码"
                    + "（宁可不给结论，也不用本地归档数据代替真实存证）");
        }
        return shape(data, key);
    }

    /**
     * 把生产域出参整理成监管页面要的形状。
     *
     * <p>时间线每条都带"有没有存证 / 状态 / 交易哈希"：没有存证就写"未上链"，
     * 不显示成空的哈希让人以为查过了。</p>
     */
    private Verification shape(JsonNode data, String key) {
        List<Map<String, Object>> events = new ArrayList<>();
        for (JsonNode node : data.path("nodes")) {
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("seq", node.path("seq").asInt(events.size() + 1));
            event.put("stage", text(node, "stage"));
            event.put("stageName", text(node, "stageName"));
            event.put("eventTitle", text(node, "title"));
            event.put("evidence", text(node, "detail"));
            event.put("operatorName", text(node, "operatorName"));
            event.put("eventTime", text(node, "occurredAt"));
            event.put("onChain", node.path("onChain").asBoolean(false));
            event.put("attested", node.path("attested").asBoolean(false));
            event.put("chainStatus", text(node, "chainStatus"));
            event.put("chainHash", orPlaceholder(text(node, "txHash"),
                    node.path("attested").asBoolean(false) ? "存证未生成交易哈希" : "未上链"));
            event.put("recordNo", text(node, "recordNo"));
            event.put("chainTime", text(node, "chainTime"));
            event.put("failedReason", text(node, "failedReason"));
            events.add(event);
        }
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("traceCode", text(data, "traceCode").isEmpty() ? key : text(data, "traceCode"));
        raw.put("productName", text(data, "productName"));
        raw.put("cropName", text(data, "cropName"));
        raw.put("qualityGrade", text(data, "qualityGrade"));
        raw.put("batchNo", text(data, "batchNo"));
        raw.put("harvestDate", text(data, "harvestDate"));
        raw.put("subjectName", text(data, "farmName"));
        raw.put("tenantId", text(data, "tenantId"));
        raw.put("status", text(data, "status"));
        raw.put("verifiable", data.path("verifiable").asBoolean(false));
        // 有效期：生产域按日期判，扫描是每小时一次，两次之间"状态还是 active 但已过期"是会出现的，
        // 所以这里要单独透传 expired，不能让监管端只看 status 自己推。
        raw.put("expiryDate", text(data, "expiryDate"));
        raw.put("expired", data.path("expired").asBoolean(false));
        raw.put("activatedAt", text(data, "activatedAt"));
        raw.put("queryCount", data.path("queryCount").asInt(0));
        raw.put("codeTxHash", text(data, "codeTxHash"));
        raw.put("source", "production");
        int nodeCount = data.path("nodeCount").asInt(events.size());
        long onChainCount = data.path("onChainCount").asLong(events.stream()
                .filter(item -> Boolean.TRUE.equals(item.get("onChain"))).count());
        long attestedCount = data.path("attestedCount").asLong(events.stream()
                .filter(item -> Boolean.TRUE.equals(item.get("attested"))).count());
        String conclusion = text(data, "chainConclusion");
        return new Verification(raw, events, nodeCount, onChainCount, attestedCount,
                conclusion.isEmpty() ? "生产域未给出存证结论" : conclusion);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNull() || value.isMissingNode() ? "" : value.asText();
    }

    /**
     * 码状态的中文说法（**门户与移动执法端共用这一处**）。
     *
     * <p>为什么放在客户端而不是各写一份：两处以前各自映射，移动端直接把生产域的
     * {@code active/inactive} 原样显示成英文，门户显示中文 —— 同一个码在两端两种说法。</p>
     *
     * @param expired 生产域按有效期算出的过期标志（扫描是每小时一次，状态可能还没被改）
     */
    public static String statusText(String status, boolean expired) {
        if (expired) {
            return "已过期";
        }
        return switch (status == null ? "" : status) {
            case "active" -> "有效";
            case "generated", "inactive" -> "未激活";
            case "scanned" -> "已扫码流通";
            case "revoked" -> "已作废";
            case "expired" -> "已过期";
            default -> status.isEmpty() ? "未知" : status;
        };
    }

    private static String orPlaceholder(String value, String placeholder) {
        return value == null || value.isEmpty() ? placeholder : value;
    }

    /** 码值可能含中文或空格，必须转义后再拼 URL（否则生产域按另一串码查，报"不存在"）。 */
    private static String enc(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8)
                .replace("+", "%20");
    }
}
