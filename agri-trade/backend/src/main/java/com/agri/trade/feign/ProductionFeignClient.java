package com.agri.trade.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.Map;

/**
 * 生产域 Feign 客户端。
 *
 * <p>产销对接通道走 {@code /p2t/platform/**}：交易运营端是平台视角，不应被"绑定了哪个
 * 生产主体"限制；该组端点由生产端用服务间密钥（X-P2t-Channel）校验，不依赖调用方令牌。
 * 生产端用户侧接口仍按令牌解析的租户隔离。</p>
 */
@FeignClient(name = "production", url = "${services.production.url}")
public interface ProductionFeignClient {

    @GetMapping("/api/production/trace/{traceCode}")
    Map<String, Object> getTraceByCode(@PathVariable String traceCode);

    @GetMapping("/api/production/harvest/{batchNo}")
    Map<String, Object> getHarvestByBatchNo(@PathVariable String batchNo);

    @GetMapping("/api/production/test/{id}")
    Map<String, Object> getTestRecordById(@PathVariable Long id);

    @GetMapping("/api/production/farm/{id}")
    Map<String, Object> getFarmById(@PathVariable Long id);

    @GetMapping("/api/production/plot/{id}")
    Map<String, Object> getPlotById(@PathVariable Long id);

    @GetMapping("/api/production/chain/{id}")
    Map<String, Object> getChainRecordById(@PathVariable Long id);

    /* ==================== 产销对接通道（平台级） ==================== */

    @GetMapping("/api/v1/production/p2t/platform/pool")
    Map<String, Object> p2tPool(@RequestHeader("Authorization") String authorization,
                                @RequestHeader("X-P2t-Channel") String channel,
                                @RequestParam("pageNum") Integer pageNum,
                                @RequestParam("pageSize") Integer pageSize,
                                @RequestParam(value = "keyword", required = false) String keyword,
                                @RequestParam(value = "auditStatus", required = false) String auditStatus);

    @GetMapping("/api/v1/production/p2t/platform/offer/{offerNo}")
    Map<String, Object> p2tOffer(@RequestHeader("Authorization") String authorization,
                                 @RequestHeader("X-P2t-Channel") String channel,
                                 @PathVariable String offerNo);

    @PostMapping("/api/v1/production/p2t/platform/pool/{offerNo}/audit")
    Map<String, Object> p2tAudit(@RequestHeader("Authorization") String authorization,
                                 @RequestHeader("X-P2t-Channel") String channel,
                                 @PathVariable String offerNo,
                                 @RequestBody Map<String, Object> payload);

    @PostMapping("/api/v1/production/p2t/platform/pool/{offerNo}/listed")
    Map<String, Object> p2tListed(@RequestHeader("Authorization") String authorization,
                                  @RequestHeader("X-P2t-Channel") String channel,
                                  @PathVariable String offerNo,
                                  @RequestBody Map<String, Object> payload);

    @PostMapping("/api/v1/production/p2t/platform/writeback")
    Map<String, Object> p2tWriteback(@RequestHeader("Authorization") String authorization,
                                     @RequestHeader("X-P2t-Channel") String channel,
                                     @RequestBody Map<String, Object> payload);

    @GetMapping("/api/v1/production/p2t/platform/reconciliation")
    Map<String, Object> p2tReconciliation(@RequestHeader("Authorization") String authorization,
                                          @RequestHeader("X-P2t-Channel") String channel);

    @GetMapping("/api/v1/production/p2t/platform/diffs")
    Map<String, Object> p2tDiffs(@RequestHeader("Authorization") String authorization,
                                 @RequestHeader("X-P2t-Channel") String channel,
                                 @RequestParam("pageNum") Integer pageNum,
                                 @RequestParam("pageSize") Integer pageSize,
                                 @RequestParam(value = "status", required = false) String status);

    @PostMapping("/api/v1/production/p2t/platform/diffs/{id}/handle")
    Map<String, Object> p2tHandleDiff(@RequestHeader("Authorization") String authorization,
                                      @RequestHeader("X-P2t-Channel") String channel,
                                      @PathVariable Long id,
                                      @RequestBody Map<String, Object> payload);

    @GetMapping("/api/v1/production/p2t/platform/trace")
    Map<String, Object> p2tTrace(@RequestHeader("Authorization") String authorization,
                                 @RequestHeader("X-P2t-Channel") String channel,
                                 @RequestParam("batchNo") String batchNo);
}
