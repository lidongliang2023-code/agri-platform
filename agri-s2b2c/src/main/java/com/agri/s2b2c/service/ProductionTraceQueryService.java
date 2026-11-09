package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.integration.ProductionTraceClient;
import com.agri.s2b2c.security.SecurityUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 商品溯源聚合：把"这个商品能不能溯源、链路长什么样"收敛到一处。
 *
 * <p>为什么要有这一层：消费者 PC 详情、消费者 PC 溯源查询页、消费者移动端三处都要展示链路。
 * 三处各自调生产域的话，字段名、空值语义、错误语义一定会漂（本项目已多次出现
 * "同一个数据三个页面三个说法"）。现在三处读同一个方法的出参。</p>
 *
 * <p><b>三种状态必须可区分</b>：
 * {@code bound=false}（供应商还没绑批次）、{@code matched=false}（绑了但生产域查无此批次）、
 * 链路不可用（抛异常，控制器转 503）。把它们统统压成空列表，就等于让页面把
 * "系统没接上" 说成 "这批货没有来历" —— 对消费者是完全不同的两件事。</p>
 */
@Service
public class ProductionTraceQueryService {

    private final ProductService productService;
    private final ProductionTraceClient production;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public ProductionTraceQueryService(ProductService productService, ProductionTraceClient production, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.jdbc = jdbc;
        this.productService = productService;
        this.production = production;
    }

    /**
     * 按商品取生产域链路视图。
     *
     * @param productId 商品主键
     * @return 带 {@code bound} / {@code matched} 标记的出参；商品不存在时 {@code bound=false} 且给出原因
     */
    public Map<String, Object> productTrace(Long productId) {
        Product product = productId == null ? null : productService.getById(productId);
        return assemble(product == null ? null : product.getProdBatchNo(),
                product == null ? null : product.getName(),
                product == null ? null : product.getOrigin(),
                product == null ? null : String.valueOf(product.getId()),
                product == null ? "商品不存在" : "该商品尚未由供应商绑定生产批次");
    }

    /**
     * 按**溯源码**核验（消费者手上有码的那条路）。
     *
     * <p>出参形状与 {@link #productTrace} 对齐（同样有 {@code bound/matched/nodes/codes/conclusion/stages}），
     * 页面一套渲染就能同时服务"按商品看链路"和"按码核验"，不需要两套字段名。</p>
     */
    public Map<String, Object> codeTrace(String code) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("traceCode", code);
        if (code == null || code.isBlank()) {
            out.put("bound", false);
            out.put("matched", false);
            out.put("reason", "溯源码为空");
            out.put("nodes", List.of());
            return out;
        }
        Map<String, Object> trace = production.codeTrace(code, SecurityUtils.getToken());
        if (trace == null) {
            out.put("bound", true);
            out.put("matched", false);
            out.put("reason", "生产管理模块查无此溯源码（可能已作废或不是本平台生成的码）");
            out.put("nodes", List.of());
            return out;
        }
        out.put("bound", true);
        out.put("matched", true);
        out.put("source", "production");
        out.put("batchNo", trace.get("batchNo"));
        out.put("productName", trace.get("productName"));
        out.put("cropName", trace.get("cropName"));
        out.put("qualityGrade", trace.get("qualityGrade"));
        out.put("harvestDate", trace.get("harvestDate"));
        out.put("farmName", trace.get("farmName"));
        out.put("plotName", trace.get("plotCode"));
        out.put("tenantId", trace.get("tenantId"));
        out.put("codeStatus", trace.get("status"));
        out.put("verifiable", trace.get("verifiable"));
        out.put("expired", trace.get("expired"));
        out.put("expiryDate", trace.get("expiryDate"));
        out.put("activatedAt", trace.get("activatedAt"));
        out.put("queryCount", trace.get("queryCount"));
        out.put("selfAttestation", trace.get("selfAttestation"));
        out.put("codes", List.of(Map.of("code", trace.get("traceCode"),
                "status", trace.get("status") == null ? "" : trace.get("status"))));
        out.put("nodes", trace.get("nodes") == null ? List.of() : trace.get("nodes"));
        out.put("nodeCount", trace.get("nodeCount"));
        out.put("onChainCount", trace.get("onChainCount"));
        out.put("attestedCount", trace.get("attestedCount"));
        out.put("conclusion", trace.get("chainConclusion"));
        out.put("stages", stagesOf(trace.get("nodes")));
        out.put("sourceBasis", "UNIT_CODE");
        // 单品真实绑定才返回零售流转；不公开订单号、客户、价格及物流单号。
        List<Map<String, Object>> circulation = jdbc.queryForList(
            "SELECT u.create_time AS boundAt, o.status AS orderStatus, o.logistics_company AS logisticsCompany "
            + "FROM s2b2c_order_trace_unit u JOIN s2b2c_order o ON o.id=u.order_id WHERE u.trace_code=?", code);
        out.put("circulation", circulation);
        out.put("circulationRecorded", !circulation.isEmpty());
        return out;
    }

    /** 按批次号取链路（供应商预览、运营排查与"按码查"命中后的批次展开都走这里）。 */
    public Map<String, Object> batchTrace(String batchNo, String productName, String origin) {
        return assemble(batchNo, productName, origin, null, "批次号为空");
    }

    private Map<String, Object> assemble(String batchNo, String productName, String origin,
                                         String productId, String unboundReason) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("batchNo", batchNo);
        out.put("productName", productName);
        out.put("origin", origin);
        out.put("productId", productId);
        if (batchNo == null || batchNo.isBlank()) {
            out.put("bound", false);
            out.put("matched", false);
            out.put("reason", unboundReason);
            out.put("nodes", List.of());
            out.put("codes", List.of());
            return out;
        }
        Map<String, Object> trace = production.batchTrace(batchNo, SecurityUtils.getToken());
        if (trace == null) {
            out.put("bound", true);
            out.put("matched", false);
            out.put("reason", "绑定的批次在生产管理模块查不到（批次可能已删除或编号填错）");
            out.put("nodes", List.of());
            out.put("codes", List.of());
            return out;
        }
        out.put("bound", true);
        out.put("matched", true);
        out.put("source", "production");
        out.put("tenantId", trace.get("tenantId"));
        out.put("farmName", trace.get("farmName"));
        out.put("plotName", trace.get("plotName"));
        out.put("cropName", trace.get("cropName"));
        out.put("qualityGrade", trace.get("qualityGrade"));
        out.put("harvestDate", trace.get("harvestDate"));
        out.put("nodes", trace.get("nodes") == null ? List.of() : trace.get("nodes"));
        out.put("codes", trace.get("codes") == null ? List.of() : trace.get("codes"));
        out.put("nodeCount", trace.get("nodeCount"));
        out.put("onChainCount", trace.get("onChainCount"));
        out.put("attestedCount", trace.get("attestedCount"));
        out.put("conclusion", trace.get("conclusion"));
        out.put("stages", stagesOf(trace.get("nodes")));
        return out;
    }

    /**
     * 链路里出现了哪些环节（{@code planting}/{@code harvest}/{@code process}/...）。
     *
     * <p>给页面做"这一环到底有没有"的判定用，而不是让前端各自遍历节点猜。
     * 种植-采收-加工是否齐全，答案在这里，一处。</p>
     */
    private static List<String> stagesOf(Object nodes) {
        List<String> stages = new ArrayList<>();
        if (nodes instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> node) {
                    Object stage = node.get("stage");
                    if (stage != null && !stages.contains(String.valueOf(stage))) {
                        stages.add(String.valueOf(stage));
                    }
                }
            }
        }
        return stages;
    }

    /**
     * 供应商可绑定的批次候选：按调用方令牌向生产域要，因此天然只含自己主体名下的批次。
     *
     * <p>不做本地"先存字符串、以后再说"的宽松绑定：能选出来的必然是真的，
     * 选不出来的绑定提交也过不去（见 {@link #requireOwnBatch}）。</p>
     */
    public List<Map<String, Object>> bindableBatches(String keyword) {
        List<Map<String, Object>> options = new ArrayList<>();
        for (Map<String, Object> row : production.myBatches(keyword, SecurityUtils.getToken())) {
            Map<String, Object> option = new LinkedHashMap<>();
            option.put("batchNo", row.get("batchNo"));
            option.put("cropName", row.get("cropName"));
            option.put("cropVariety", row.get("cropVariety"));
            option.put("grade", row.get("grade"));
            option.put("harvestDate", row.get("harvestDate"));
            option.put("plotName", row.get("plotName"));
            option.put("farmName", row.get("farmName"));
            option.put("traceCode", row.get("traceCode"));
            options.add(option);
        }
        return options;
    }

    /**
     * 校验供应商提交的批次确实属于他当前主体；不属于就拒绝。
     *
     * @throws IllegalArgumentException 生产域在该账号名下查不到这个批次
     */
    public void requireOwnBatch(String batchNo) {
        if (batchNo == null || batchNo.isBlank()) {
            return;
        }
        boolean found = production.myBatches(batchNo, SecurityUtils.getToken()).stream()
                .anyMatch(row -> batchNo.trim().equalsIgnoreCase(String.valueOf(row.get("batchNo"))));
        if (!found) {
            throw new IllegalArgumentException("批次 " + batchNo + " 不在你所属经营主体名下（或该批次不存在）。"
                    + "只能绑定本主体在生产管理模块登记的采收批次，不能借用别人的链路。");
        }
    }
}
