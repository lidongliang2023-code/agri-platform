package com.agri.trade.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Map;

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
}