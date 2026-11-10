package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.SensorDataMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpStatusCodeException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;

/** 只接受仓单号，主体、批次与设备范围均由可信业务记录推导。 */
@RestController
public class FinanceWarehouseMonitorController {
    private final String token;
    private final String financeUrl;
    private final HarvestBatchMapper batches;
    private final SensorDataMapper sensors;
    private final RestTemplate client;
    public FinanceWarehouseMonitorController(HarvestBatchMapper batches, SensorDataMapper sensors,
            @Value("${finance-warehouse.token:${AGRI_FINANCE_WAREHOUSE_TOKEN:}}") String token,
            @Value("${services.finance.url:http://localhost:8087}") String financeUrl) {
        this.batches=batches; this.sensors=sensors; this.token=token; this.financeUrl=financeUrl;
        SimpleClientHttpRequestFactory f=new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(3000); f.setReadTimeout(5000); client=new RestTemplate(f);
    }
    @GetMapping("/internal/finance/warehouse/{receiptId}/sensors")
    public ApiResponse<List<Map<String,Object>>> sensors(@PathVariable String receiptId,
            @RequestHeader(value="X-Finance-Warehouse-Token", defaultValue="") String supplied,
            @RequestHeader(value="Authorization", defaultValue="") String bearer) {
        if (token.isBlank() || !MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),
                supplied.getBytes(StandardCharsets.UTF_8))) throw new BusinessException(403,"仓储监控服务鉴权失败");
        if (!bearer.startsWith("Bearer ") || bearer.substring(7).isBlank()) throw new BusinessException(401,"缺少平台访问令牌");
        HttpHeaders h=new HttpHeaders(); h.setBearerAuth(bearer.substring(7));
        h.set("X-Finance-Warehouse-Token",token);
        Map<?,?> envelope;
        try {
            envelope=client.exchange(financeUrl+"/internal/warehouse-monitor/{id}/scope",HttpMethod.GET,
                    new HttpEntity<>(h),Map.class,receiptId).getBody();
        } catch (HttpStatusCodeException e) {
            int code=e.getStatusCode().value();
            throw new BusinessException(code==401||code==403||code==404?code:503,"金融仓储授权校验未通过");
        } catch (RestClientException e) { throw new BusinessException(503,"金融仓储授权服务不可用"); }
        if (envelope==null || !(envelope.get("code") instanceof Number code)) throw new BusinessException(503,"金融授权响应无效");
        if (code.intValue()!=0) {
            int status=code.intValue();
            throw new BusinessException(status==401||status==403||status==404?status:503,"金融仓储授权校验未通过");
        }
        if (!(envelope.get("data") instanceof Map<?,?> scope)
                || !receiptId.equals(String.valueOf(scope.get("receiptId")))) throw new BusinessException(403,"仓单授权范围不一致");
        Long batchId;
        try { batchId=Long.valueOf(String.valueOf(scope.get("batchId"))); }
        catch (NumberFormatException e) { throw new BusinessException(403,"批次授权无效"); }
        HarvestBatch batch=batches.selectById(batchId);
        if (batch==null || batch.getTenantId()==null
                || !batch.getTenantId().equals(String.valueOf(scope.get("tenantId")))
                || !java.util.Objects.equals(batch.getBatchNo(),scope.get("batchNo"))) throw new BusinessException(404,"授权批次不存在");
        if (batch.getFarmId()==null && batch.getPlotId()==null) return ApiResponse.success(List.of());
        return ApiResponse.success(sensors.getWarehouseLatest(batch.getTenantId(),batch.getFarmId(),batch.getPlotId()));
    }
}
