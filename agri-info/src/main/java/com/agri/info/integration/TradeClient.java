package com.agri.info.integration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 交易撮合服务（agri-trade）的调用客户端。
 *
 * <p>信息资讯的供需大厅不再自己维护供应/需求/撮合三套数据，全部复用交易模块：
 * 供应=agri_trade_product、需求=agri_trade_demand、撮合=agri_trade_match_record。
 * 本类只负责把 HTTP 细节和错误口径收口，字段映射交给 {@link SupplyDemandService}。</p>
 *
 * <p>令牌直接透传用户自己的 Authorization，不换服务账号 —— 这样交易模块的
 * 主体归属（卖家/买家）与权限校验仍然按真实用户生效，不会因为"经信息资讯转发"
 * 就变成谁都能以任意主体发布。</p>
 */
@Component
public class TradeClient {

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public TradeClient(RestTemplateBuilder builder,
                       @Value("${agri.info.trade.base-url}") String baseUrl,
                       @Value("${agri.info.trade.connect-timeout-ms:3000}") int connectTimeout,
                       @Value("${agri.info.trade.read-timeout-ms:15000}") int readTimeout) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofMillis(connectTimeout))
                .setReadTimeout(Duration.ofMillis(readTimeout))
                .build();
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public Map<String, Object> getMap(String path, String authorization, Map<String, Object> query) {
        Object data = exchange(HttpMethod.GET, path, authorization, null, query, null);
        return asMap(data);
    }

    public List<Map<String, Object>> getList(String path, String authorization, Map<String, Object> query) {
        Object data = exchange(HttpMethod.GET, path, authorization, null, query, null);
        return asList(data);
    }

    public Map<String, Object> postMap(String path, String authorization, Object body, String source) {
        Object data = exchange(HttpMethod.POST, path, authorization, body, null, source);
        return asMap(data);
    }

    public List<Map<String, Object>> postList(String path, String authorization, Object body, String source) {
        Object data = exchange(HttpMethod.POST, path, authorization, body, null, source);
        return asList(data);
    }

    /** 需求下架等就地更新走 PUT；交易模块的需求更新接口是 PUT /api/trade/demand/{id}。 */
    public Map<String, Object> putMap(String path, String authorization, Object body) {
        Object data = exchange(HttpMethod.PUT, path, authorization, body, null, null);
        return asMap(data);
    }

    /**
     * @param source 发布来源。传 "info" 时交易模块会跳过商品审核直接上架 ——
     *               供需大厅没有审核入口，不这么做用户发完在大厅里看不到自己的信息。
     */
    private Object exchange(HttpMethod method, String path, String authorization,
                            Object body, Map<String, Object> query, String source) {
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
        if (source != null && !source.isBlank()) {
            headers.set("X-Agri-Source", source);
        }

        try {
            // 必须显式按 UTF-8 编码：UriComponentsBuilder 的 build() 不会转义查询参数，
            // 中文关键词会以原始字节进 URL，Tomcat 直接按 RFC 7230 拒成 400
            // （日志里表现为 keyword=0xc10xaa0xb6…）。
            java.net.URI uri = builder.encode(StandardCharsets.UTF_8).build().toUri();
            ResponseEntity<Map> response = restTemplate.exchange(
                    uri, method, new HttpEntity<>(body, headers), Map.class);
            Map<String, Object> payload = response.getBody();
            if (payload == null) {
                throw new IllegalArgumentException("交易撮合服务无响应");
            }
            Object code = payload.get("code");
            if (code != null && !"200".equals(String.valueOf(code)) && !"0".equals(String.valueOf(code))) {
                throw new IllegalArgumentException(
                        String.valueOf(payload.getOrDefault("message", "交易撮合服务处理失败")));
            }
            return payload.get("data");
        } catch (RestClientResponseException e) {
            // 交易模块把业务错误放在 body.message 里，HTTP 层可能是 400/403，
            // 直接把它的原话抛给前端，比统一改写成"服务不可用"更有用。
            String message = e.getResponseBodyAsString();
            throw new IllegalArgumentException(message == null || message.isBlank()
                    ? "交易撮合服务返回异常（HTTP " + e.getRawStatusCode() + "）"
                    : extractMessage(message));
        } catch (ResourceAccessException e) {
            throw new IllegalArgumentException("交易撮合服务暂时不可达，请稍后重试");
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object data) {
        return data instanceof Map ? (Map<String, Object>) data : Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object data) {
        return data instanceof List ? (List<Map<String, Object>>) data : List.of();
    }

    /** 从交易模块的错误 JSON 里抠出 message，抠不出就返回原文。 */
    private String extractMessage(String raw) {
        int start = raw.indexOf("\"message\"");
        if (start < 0) {
            return raw.length() > 200 ? raw.substring(0, 200) : raw;
        }
        int colon = raw.indexOf(':', start);
        int begin = raw.indexOf('"', colon + 1);
        int end = raw.indexOf('"', begin + 1);
        return begin > 0 && end > begin ? raw.substring(begin + 1, end) : raw;
    }
}
