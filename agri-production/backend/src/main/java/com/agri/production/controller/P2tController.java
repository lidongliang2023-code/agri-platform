package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.P2tDiffTicket;
import com.agri.production.entity.P2tOffer;
import com.agri.production.entity.P2tSubscription;
import com.agri.production.entity.P2tVarietyMap;
import com.agri.production.service.P2tService;
import com.agri.production.service.TenantContextService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 产销对接（生产侧）接口。
 *
 * <p>路径前缀 {@code /api/v1/production/p2t}。前半段供生产运营端使用；
 * 「池 / 审核 / 建品回写 / 回写 / 对账」这几条是交易撮合模块通过服务端 Feign 调用的通道接口，
 * 同样按当前登录主体的 tenantId 隔离，不允许跨主体读写。</p>
 */
@RestController
@RequestMapping("/api/v1/production/p2t")
public class P2tController {

    private final P2tService p2tService;

    /**
     * 产销对接服务间通道密钥（交易撮合后端调用时携带）。
     *
     * <p>交易运营端本身是平台视角，不应该被"绑定了哪个生产主体"限制；但也不能把
     * 生产端接口对公网裸开。这条通道只给交易撮合服务使用，密钥不一致一律 403。</p>
     */
    @Value("${p2t.trade-channel-token:}")
    private String tradeChannelToken;

    public P2tController(P2tService p2tService) {
        this.p2tService = p2tService;
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.agri.production.integration.TradeLogisticsClient tradeLogistics;

    @GetMapping("/trace/logistics")
    public ApiResponse<com.fasterxml.jackson.databind.JsonNode> logisticsTrace(@RequestParam String batchNo,
            @RequestParam String offerNo) {
        String tenant = TenantContextService.currentTenantId();
        Map<String, Object> chain = p2tService.traceByBatch(batchNo.trim(), tenant, false);
        Object value = chain.get("offers");
        boolean owned = value instanceof List<?> list && list.stream().anyMatch(row ->
            row instanceof P2tOffer offer && java.util.Objects.equals(offer.getOfferNo(), offerNo.trim()));
        if (chain.get("batch") == null || !owned) {
            throw new com.agri.production.common.exception.BusinessException(404, "当前主体批次下不存在该供给单");
        }
        return ApiResponse.success(tradeLogistics.byOffer(offerNo.trim(), tenant));
    }

    /* ==================== 总览 ==================== */

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(p2tService.overview(TenantContextService.currentTenantId()));
    }

    /* ==================== 品种对接表 ==================== */

    @GetMapping("/varieties")
    public ApiResponse<PageResult<P2tVarietyMap>> pageVarieties(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status) {
        return ApiResponse.success(p2tService.pageVarieties(firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 10), keyword, status, TenantContextService.currentTenantId()));
    }

    @PostMapping("/varieties")
    public ApiResponse<P2tVarietyMap> createVariety(@RequestBody P2tVarietyMap payload) {
        payload.setId(null);
        return ApiResponse.success(p2tService.saveVariety(payload, TenantContextService.currentTenantId()));
    }

    @PutMapping("/varieties/{id}")
    public ApiResponse<P2tVarietyMap> updateVariety(@PathVariable Long id, @RequestBody P2tVarietyMap payload) {
        payload.setId(id);
        return ApiResponse.success(p2tService.saveVariety(payload, TenantContextService.currentTenantId()));
    }

    @DeleteMapping("/varieties/{id}")
    public ApiResponse<Void> deleteVariety(@PathVariable Long id) {
        p2tService.deleteVariety(id, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    @GetMapping("/varieties/by-crop")
    public ApiResponse<List<P2tVarietyMap>> mapsOfCrop(
            @RequestParam(required = false) Long cropId,
            @RequestParam(required = false) String cropName) {
        return ApiResponse.success(p2tService.mapsOfCrop(cropId, cropName, TenantContextService.currentTenantId()));
    }

    /* ==================== 采收批次与可售量 ==================== */

    @GetMapping("/batches")
    public ApiResponse<PageResult<Map<String, Object>>> pageBatches(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(p2tService.pageBatches(firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 10), keyword, TenantContextService.currentTenantId()));
    }

    /* ==================== 供给意向 ==================== */

    @GetMapping("/offers")
    public ApiResponse<PageResult<P2tOffer>> pageOffers(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String auditStatus,
            @RequestParam(required = false) String tradeStatus,
            @RequestParam(required = false) Long batchId) {
        return ApiResponse.success(p2tService.pageOffers(firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 10), keyword, auditStatus, tradeStatus, batchId,
                TenantContextService.currentTenantId()));
    }

    @GetMapping("/offers/by-no/{offerNo}")
    public ApiResponse<P2tOffer> offerByNo(@PathVariable String offerNo) {
        return ApiResponse.success(p2tService.findOffer(offerNo, TenantContextService.currentTenantId()));
    }

    @PostMapping("/offers")
    public ApiResponse<P2tOffer> createOffer(@RequestBody Map<String, Object> payload) {
        return ApiResponse.success(p2tService.createOffer(payload, TenantContextService.currentTenantId()));
    }

    @PutMapping("/offers/{id}")
    public ApiResponse<P2tOffer> updateOffer(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        return ApiResponse.success(p2tService.updateOffer(id, payload, TenantContextService.currentTenantId()));
    }

    @PostMapping("/offers/{id}/submit")
    public ApiResponse<P2tOffer> submitOffer(@PathVariable Long id) {
        return ApiResponse.success(p2tService.submitOffer(id, TenantContextService.currentTenantId()));
    }

    @PostMapping("/offers/{id}/close")
    public ApiResponse<P2tOffer> closeOffer(@PathVariable Long id) {
        return ApiResponse.success(p2tService.closeOffer(id, TenantContextService.currentTenantId()));
    }

    @DeleteMapping("/offers/{id}")
    public ApiResponse<Void> deleteOffer(@PathVariable Long id) {
        p2tService.deleteOffer(id, TenantContextService.currentTenantId());
        return ApiResponse.success();
    }

    /* ==================== 认购台账 ==================== */

    @GetMapping("/subscriptions")
    public ApiResponse<PageResult<Map<String, Object>>> pageSubscriptions(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(p2tService.pageSubscriptionSummary(firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 10), keyword, TenantContextService.currentTenantId()));
    }

    @GetMapping("/subscriptions/flows")
    public ApiResponse<PageResult<P2tSubscription>> subscriptionFlows(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String offerNo,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String writebackStatus) {
        return ApiResponse.success(p2tService.pageSubscriptionFlows(firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 10), keyword, offerNo, eventType, writebackStatus,
                TenantContextService.currentTenantId()));
    }

    /* ==================== 需求反哺 / 差异 ==================== */

    @GetMapping("/demand-signals")
    public ApiResponse<List<Map<String, Object>>> demandSignals(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate startDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate endDate) {
        return ApiResponse.success(p2tService.demandSignals(TenantContextService.currentTenantId(), startDate, endDate));
    }

    @GetMapping("/diffs")
    public ApiResponse<PageResult<P2tDiffTicket>> pageDiffs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String diffType,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(p2tService.pageDiffs(firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 10), status, diffType, keyword, TenantContextService.currentTenantId()));
    }

    @GetMapping("/diffs/reship-requirement")
    public ApiResponse<Map<String, Object>> reshipRequirement(@RequestParam String ticketNo) {
        return ApiResponse.success(p2tService.reshipRequirement(ticketNo, TenantContextService.currentTenantId()));
    }

    @PostMapping("/diffs/{id}/handle")
    public ApiResponse<P2tDiffTicket> handleDiff(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        return ApiResponse.success(p2tService.handleDiff(id,
                payload.get("status") == null ? null : String.valueOf(payload.get("status")),
                payload.get("handleWay") == null ? null : String.valueOf(payload.get("handleWay")),
                payload.get("remark") == null ? null : String.valueOf(payload.get("remark")),
                payload.get("evidenceNo") == null ? null : String.valueOf(payload.get("evidenceNo")),
                payload.get("expectedStatus") == null ? null : String.valueOf(payload.get("expectedStatus")),
                TenantContextService.currentTenantId()));
    }

    /* ==================== 对账 / 全链路 ==================== */

    @GetMapping("/reconciliation")
    public ApiResponse<List<Map<String, Object>>> reconciliation() {
        return ApiResponse.success(p2tService.reconciliation(TenantContextService.currentTenantId()));
    }

    @GetMapping("/trace")
    public ApiResponse<Map<String, Object>> trace(@RequestParam String batchNo, @RequestParam(defaultValue = "true") boolean includeSubscriptions) {
        return ApiResponse.success(p2tService.traceByBatch(batchNo.trim(),
                TenantContextService.currentTenantId(), includeSubscriptions));
    }

    /* ==================== 交易端通道 ==================== */

    @GetMapping("/pool")
    public ApiResponse<PageResult<P2tOffer>> pool(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String auditStatus) {
        return ApiResponse.success(p2tService.pagePool(firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 10), keyword, auditStatus, TenantContextService.currentTenantId()));
    }

    @PostMapping("/pool/{offerNo}/audit")
    public ApiResponse<P2tOffer> audit(@RequestHeader(value = "X-P2t-Channel", required = false) String channel, @PathVariable String offerNo, @RequestBody Map<String, Object> payload) {
        requireChannel(channel);
        boolean approved = Boolean.parseBoolean(String.valueOf(payload.getOrDefault("approved", true)));
        String remark = payload.get("remark") == null ? null : String.valueOf(payload.get("remark"));
        String auditor = payload.get("auditor") == null ? null : String.valueOf(payload.get("auditor"));
        return ApiResponse.success(p2tService.auditOffer(offerNo, approved, remark, auditor,
                TenantContextService.currentTenantId()));
    }

    @PostMapping("/pool/{offerNo}/listed")
    public ApiResponse<P2tOffer> listed(@RequestHeader(value = "X-P2t-Channel", required = false) String channel, @PathVariable String offerNo, @RequestBody Map<String, Object> payload) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.markListed(offerNo,
                payload.get("productCode") == null ? null : String.valueOf(payload.get("productCode")),
                payload.get("productName") == null ? null : String.valueOf(payload.get("productName")),
                payload.get("listedQty") == null ? null : new java.math.BigDecimal(String.valueOf(payload.get("listedQty"))),
                payload.get("listedPrice") == null ? null : new java.math.BigDecimal(String.valueOf(payload.get("listedPrice"))),
                TenantContextService.currentTenantId()));
    }

    @PostMapping("/writeback")
    public ApiResponse<Map<String, Object>> writeback(@RequestHeader(value = "X-P2t-Channel", required = false) String channel, @RequestBody Map<String, Object> payload) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.writeback(payload, TenantContextService.currentTenantId()));
    }

    /* ==================== 交易端通道（平台级） ==================== */

    /**
     * 平台级通道：不加租户过滤，供交易运营端查看所有生产主体的供给。
     *
     * <p>与上面的用户侧通道共用业务逻辑，差别只有两点：租户传 null；必须带服务间密钥。
     * 生产端用户侧的接口一律仍按当前主体隔离。</p>
     */
    @GetMapping("/platform/pool")
    public ApiResponse<PageResult<P2tOffer>> platformPool(
            @RequestHeader("X-P2t-Channel") String channel,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String auditStatus) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.pagePool(firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 10), keyword, auditStatus, null));
    }

    @GetMapping("/platform/offer/{offerNo}")
    public ApiResponse<P2tOffer> platformOffer(@RequestHeader("X-P2t-Channel") String channel,
                                              @PathVariable String offerNo) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.findOffer(offerNo, null));
    }

    @PostMapping("/platform/pool/{offerNo}/audit")
    public ApiResponse<P2tOffer> platformAudit(@RequestHeader("X-P2t-Channel") String channel,
                                               @PathVariable String offerNo,
                                               @RequestBody Map<String, Object> payload) {
        requireChannel(channel);
        boolean approved = Boolean.parseBoolean(String.valueOf(payload.getOrDefault("approved", true)));
        String remark = payload.get("remark") == null ? null : String.valueOf(payload.get("remark"));
        String auditor = payload.get("auditor") == null ? null : String.valueOf(payload.get("auditor"));
        return ApiResponse.success(p2tService.auditOffer(offerNo, approved, remark, auditor, null));
    }

    @PostMapping("/platform/pool/{offerNo}/listed")
    public ApiResponse<P2tOffer> platformListed(@RequestHeader("X-P2t-Channel") String channel,
                                                @PathVariable String offerNo,
                                                @RequestBody Map<String, Object> payload) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.markListed(offerNo,
                payload.get("productCode") == null ? null : String.valueOf(payload.get("productCode")),
                payload.get("productName") == null ? null : String.valueOf(payload.get("productName")),
                payload.get("listedQty") == null ? null : new java.math.BigDecimal(String.valueOf(payload.get("listedQty"))),
                payload.get("listedPrice") == null ? null : new java.math.BigDecimal(String.valueOf(payload.get("listedPrice"))),
                null));
    }

    @PostMapping("/platform/writeback")
    public ApiResponse<Map<String, Object>> platformWriteback(@RequestHeader("X-P2t-Channel") String channel,
                                                             @RequestBody Map<String, Object> payload) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.writeback(payload, null));
    }

    @GetMapping("/platform/reconciliation")
    public ApiResponse<List<Map<String, Object>>> platformReconciliation(
            @RequestHeader("X-P2t-Channel") String channel) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.reconciliation(null));
    }

    @GetMapping("/platform/diffs")
    public ApiResponse<PageResult<P2tDiffTicket>> platformDiffs(
            @RequestHeader("X-P2t-Channel") String channel,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String status) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.pageDiffs(firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 10), status, null));
    }

    @PostMapping("/platform/diffs/{id}/handle")
    public ApiResponse<P2tDiffTicket> platformHandleDiff(@RequestHeader("X-P2t-Channel") String channel,
                                                        @PathVariable Long id,
                                                        @RequestBody Map<String, Object> payload) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.handleDiff(id,
                payload.get("status") == null ? null : String.valueOf(payload.get("status")),
                payload.get("handleWay") == null ? null : String.valueOf(payload.get("handleWay")),
                payload.get("remark") == null ? null : String.valueOf(payload.get("remark")),
                null));
    }

    @GetMapping("/platform/trace")
    public ApiResponse<Map<String, Object>> platformTrace(@RequestHeader("X-P2t-Channel") String channel,
                                                         @RequestParam String batchNo) {
        requireChannel(channel);
        return ApiResponse.success(p2tService.traceByBatch(batchNo.trim(), null));
    }

    /** 校验服务间通道密钥：未配置或与请求头不一致一律拒绝，绝不放行跨主体查询。 */
    private void requireChannel(String channel) {
        if (tradeChannelToken == null || tradeChannelToken.isBlank()
                || channel == null || !tradeChannelToken.equals(channel.trim())) {
            throw new com.agri.production.common.exception.BusinessException(403, "无效的产销对接服务通道");
        }
    }

    private static int firstNonNull(Integer first, Integer second, int fallback) {
        if (first != null && first > 0) return first;
        if (second != null && second > 0) return second;
        return fallback;
    }
}
