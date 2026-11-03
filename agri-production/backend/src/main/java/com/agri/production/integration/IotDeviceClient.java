package com.agri.production.integration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 物联网系统（agri-iot）的设备接口客户端。
 *
 * <p><b>为什么要有这个类</b>：设备台账原本在生产管理里存了一份副本
 * （{@code agri_prod_iot_device}），和物联网系统的 {@code iot_device} 各走各的，
 * 结果是「生产端看到 13 台、物联网端看到 16 台」，两边根本不是同一批设备。
 * 现在设备本体统一以物联网系统为唯一数据源，生产管理只做字段映射和展示。</p>
 *
 * <p><b>令牌透传</b>：直接用调用方自己的 {@code Authorization}，不换服务账号 ——
 * 物联网端靠 {@code iot:read / iot:write} 判权、并据此反查所属租户的农场范围，
 * 换成服务账号会把这些隔离全部抹平。当前所有用户都是 {@code FARMER} 角色，
 * 本身带这两个权限码，所以透传是可行的。</p>
 *
 * <p><b>为什么不用现成的 {@code IotFeignClient}</b>：那个 Feign 接口指向
 * {@code /api/iot/device/*}，是物联网端一套从未启用的遗留实现（无 DDL、无 Mapper XML），
 * 真正在跑的是 {@code /api/v1/iot/app/*}。它至今没有任何调用方，属于死代码。</p>
 */
@Component
public class IotDeviceClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public IotDeviceClient(RestTemplateBuilder builder,
                           @Value("${services.iot.url:http://localhost:8091}") String baseUrl,
                           @Value("${agri.production.iot.connect-timeout-ms:3000}") int connectTimeout,
                           @Value("${agri.production.iot.read-timeout-ms:15000}") int readTimeout) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofMillis(connectTimeout))
                .setReadTimeout(Duration.ofMillis(readTimeout))
                .build();
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    /**
     * 查询设备列表（{@code GET /api/v1/iot/app/devices}）。
     *
     * <p>物联网端该接口返回全量数组、不分页，分页由调用方在内存里做。</p>
     */
    public List<Map<String, Object>> listDevices(String authorization, Map<String, Object> query) {
        Object data = exchange(HttpMethod.GET, "/api/v1/iot/app/devices", authorization, null, query);
        return asList(data);
    }

    /** 查询单台设备（{@code GET /api/v1/iot/app/devices/{id}}）。 */
    public Map<String, Object> getDevice(String authorization, long id) {
        Object data = exchange(HttpMethod.GET, "/api/v1/iot/app/devices/" + id, authorization, null, null);
        return asMap(data);
    }

    /**
     * 更新设备（{@code PUT /api/v1/iot/app/devices/{id}}）。
     *
     * <p>生产端把设备绑定到地块后，靠这个接口回写 {@code plotId}，
     * 保证物联网端的设备归属与生产端的绑定关系一致。</p>
     */
    public Map<String, Object> updateDevice(String authorization, long id, Map<String, Object> body) {
        Object data = exchange(HttpMethod.PUT, "/api/v1/iot/app/devices/" + id, authorization, body, null);
        return asMap(data);
    }

    /** 查询设备类型（供页面下拉，避免生产端再维护一份类型字典）。 */
    public List<Map<String, Object>> deviceTypes(String authorization) {
        Object data = exchange(HttpMethod.GET, "/api/v1/iot/app/device-types", authorization, null, null);
        return asList(data);
    }

    /**
     * 设备数量统计（{@code GET /api/v1/iot/app/device-stats}）。
     *
     * <p>管理端大盘 / 农场详情 / 报表 / AI 助手都只关心"共几台、在线几台"。
     * 设备台账收敛到物联网端后，这些统计必须来这里取数，否则它们读的还是
     * 生产端那张不再更新的历史副本。</p>
     *
     * @param farmId 农场 ID，为空表示当前租户全部农场
     * @return total / online / offline / alert；物联网端不可达时返回 null，由调用方决定降级
     */
    public Map<String, Object> deviceStats(String authorization, Long farmId) {
        Map<String, Object> query = new java.util.LinkedHashMap<>();
        if (farmId != null && farmId > 0) {
            query.put("farmId", farmId);
        }
        Object data = exchange(HttpMethod.GET, "/api/v1/iot/app/device-stats", authorization, null, query);
        return asMap(data);
    }

    private Object exchange(HttpMethod method, String path, String authorization,
                            Object body, Map<String, Object> query) {
        UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(baseUrl + path);
        if (query != null) {
            query.forEach((key, value) -> {
                if (value != null && !String.valueOf(value).isBlank()) {
                    builder.queryParam(key, value);
                }
            });
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (authorization != null && !authorization.isBlank()) {
            headers.set(HttpHeaders.AUTHORIZATION, authorization);
        }
        HttpEntity<Object> entity = new HttpEntity<>(body, headers);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    builder.build(true).toUri(), method, entity, Map.class);
            Map<?, ?> payload = response.getBody();
            return payload == null ? null : payload.get("data");
        } catch (RestClientResponseException e) {
            // 把物联网端的 4xx 转成业务异常，页面才能看到"设备不存在/无权限"这类真实原因，
            // 而不是统一变成一个 500。
            String message = e.getResponseBodyAsString(StandardCharsets.UTF_8);
            throw new IllegalArgumentException("物联网服务返回 " + e.getStatusCode().value()
                    + "：" + (message == null || message.isBlank() ? e.getStatusText() : message));
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object data) {
        return data instanceof Map ? (Map<String, Object>) data : null;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object data) {
        if (data instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return List.of();
    }
}
