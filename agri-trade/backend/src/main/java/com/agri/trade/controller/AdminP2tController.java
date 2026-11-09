package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.entity.P2tRuleConfig;
import com.agri.trade.service.P2tTradeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 产销对接（交易侧）的**平台治理接口**。
 *
 * <p>路径前缀 {@code /api/trade/admin/p2t}，落在运营端 RBAC 范围内。</p>
 *
 * <p><b>2026-11-03 收口：平台不再代做对接。</b>原先这里的
 * {@code pool → audit → build → products → price} 五步是"运营替供应商接单"，
 * 而且建品时把商品的 {@code seller_id} 写成**生产主体**的编号，等于平台代建了一件挂在农场名下的商品。
 * 对接是生产主体与供应商主体之间的事，这五步已经迁到卖家中心
 * {@code /api/trade/seller/p2t/**}（见 {@link SellerP2tController}）。
 * 这里保留的只有平台职责：回写状态与重试、产销对账、差异处置、全链路追踪、规则配置。</p>
 *
 * <p>被下线的五条路由**留着处理器返回 410**而不是直接删：删掉之后这条路径会落到静态资源兜底，
 * 返回的是一个看不出原因的 HTTP 500，与真崩溃无法区分（本项目踩过）。410 带上一句"改由谁承接"，
 * 老链接点进去能看到明确答复。</p>
 */
@RestController
@RequestMapping("/api/trade/admin/p2t")
public class AdminP2tController {

    /** 下线说明：一处写清，五条路由共用，避免每条各写一句日后漂移。 */
    private static final String RETIRED = "产销对接的审核与建品已改由供应商主体在卖家中心承接"
            + "（/api/trade/seller/p2t/**），平台运营不再代做对接";

    private final P2tTradeService p2tTradeService;

    public AdminP2tController(P2tTradeService p2tTradeService) {
        this.p2tTradeService = p2tTradeService;
    }

    /* ==================== 已下线：平台代做的对接动作 ==================== */

    @GetMapping("/pool")
    public ResponseEntity<Map<String, Object>> pool() {
        return retired();
    }

    @GetMapping("/offer/{offerNo}")
    public ResponseEntity<Map<String, Object>> offer(@PathVariable String offerNo) {
        return retired();
    }

    @PostMapping("/pool/{offerNo}/audit")
    public ResponseEntity<Map<String, Object>> audit(@PathVariable String offerNo,
                                                     @RequestBody Map<String, Object> payload) {
        return retired();
    }

    @PostMapping("/build")
    public ResponseEntity<Map<String, Object>> build(@RequestBody Map<String, Object> payload) {
        return retired();
    }

    @GetMapping("/products")
    public ResponseEntity<Map<String, Object>> products() {
        return retired();
    }

    @PostMapping("/products/{id}/price")
    public ResponseEntity<Map<String, Object>> updatePrice(@PathVariable Long id,
                                                           @RequestBody Map<String, Object> payload) {
        return retired();
    }

    private ResponseEntity<Map<String, Object>> retired() {
        return ResponseEntity.status(410).body(Map.of("code", 410, "message", RETIRED));
    }

    /* ==================== 保留：平台治理职责 ==================== */

    @GetMapping("/orders")
    public ApiResponse<Map<String, Object>> orders(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(p2tTradeService.orderPage(pageNum, pageSize, keyword, status));
    }

    @PostMapping("/orders/{orderNo}/retry")
    public ApiResponse<Map<String, Object>> retry(@PathVariable String orderNo) {
        try {
            return ApiResponse.success(p2tTradeService.retryWriteback(orderNo));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/recon")
    public ApiResponse<Object> recon() {
        try {
            return ApiResponse.success(p2tTradeService.reconciliation());
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/diffs")
    public ApiResponse<Map<String, Object>> diffs(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String status) {
        try {
            return ApiResponse.success(p2tTradeService.diffs(pageNum, pageSize, status));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/diffs/{id}/handle")
    public ApiResponse<Map<String, Object>> handleDiff(@PathVariable Long id,
                                                       @RequestBody Map<String, Object> payload) {
        try {
            return ApiResponse.success(p2tTradeService.handleDiff(id, payload));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/trace")
    public ApiResponse<Map<String, Object>> trace(@RequestParam String batchNo) {
        try {
            return ApiResponse.success(p2tTradeService.trace(batchNo));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/rules")
    public ApiResponse<List<P2tRuleConfig>> rules() {
        return ApiResponse.success(p2tTradeService.rules());
    }

    @PutMapping("/rules/{ruleCode}")
    public ApiResponse<P2tRuleConfig> saveRule(@PathVariable String ruleCode,
                                               @RequestBody Map<String, Object> payload) {
        try {
            String json = payload.get("ruleJson") == null ? "{}" : String.valueOf(payload.get("ruleJson"));
            String version = payload.get("version") == null ? null : String.valueOf(payload.get("version"));
            return ApiResponse.success(p2tTradeService.saveRule(ruleCode, json, version));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
