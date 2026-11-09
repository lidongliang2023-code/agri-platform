package com.agri.s2b2c.controller;

import com.agri.s2b2c.integration.ProductionTraceUnavailableException;
import com.agri.s2b2c.service.ProductionTraceQueryService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 免登录的溯源核验入口（{@code /api/public/trace/**}，见 {@code WebConfig} 的排除规则）。
 *
 * <p><b>为什么要免登录</b>：溯源码存在的唯一意义，是"任何人拿到这串码都能验"。
 * 之前两个查询端点都挂在 {@code @OperatorOnly("s2b2c:consumer")} 上，而商城的认证拦截器
 * 要求 {@code /api/**} 一律带令牌 —— 于是消费者扫了包装上的码，第一步被要求"先注册登录"。
 * 那不是"一物一码可溯源"，那是"一物一码、先注册再溯源"。</p>
 *
 * <p><b>边界</b>：这一族只读、只回核验要用的字段（链路节点、码状态、链上结论），
 * 不回价格/库存/客户等经营数据；下游用的也是生产域自己的公开端点。
 * 尚未做限流与防码值枚举，属于已知缺口（本地演示环境），上线前要在网关侧补。</p>
 */
@RestController
@RequestMapping("/api/public/trace")
public class PublicTraceController {

    private final ProductionTraceQueryService traceQueryService;

    public PublicTraceController(ProductionTraceQueryService traceQueryService) {
        this.traceQueryService = traceQueryService;
    }

    /** 按溯源码核验：命中给链路，查无此码 404，链路不可用 503（三种结果在页面上必须是三句话）。 */
    @GetMapping("/code/{code}")
    public ResponseEntity<?> byCode(@PathVariable String code) {
        try {
            Map<String, Object> trace = traceQueryService.codeTrace(code);
            if (!Boolean.TRUE.equals(trace.get("matched"))) {
                return ResponseEntity.status(404).body(Map.of(
                        "success", false, "matched", false,
                        "message", trace.get("reason") == null ? "未查询到该溯源码" : trace.get("reason")));
            }
            return ResponseEntity.ok(trace);
        } catch (ProductionTraceUnavailableException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("success", false, "unavailable", true, "message", e.getMessage()));
        }
    }

    /** 按商品看链路（商品已绑定批次时）；未绑定回 {@code bound=false} 并说明原因。 */
    @GetMapping("/product/{productId}")
    public ResponseEntity<?> byProduct(@PathVariable Long productId) {
        try {
            return ResponseEntity.ok(traceQueryService.productTrace(productId));
        } catch (ProductionTraceUnavailableException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("success", false, "unavailable", true, "message", e.getMessage()));
        }
    }
}
