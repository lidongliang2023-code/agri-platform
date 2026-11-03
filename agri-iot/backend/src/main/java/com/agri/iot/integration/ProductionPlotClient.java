package com.agri.iot.integration;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产管理地块主数据客户端。
 *
 * <p>物联网地块监测不维护第二套地块档案。列表、名称、面积、作物、生产状态均以
 * agri-production 的租户地块接口为准；IoT 只补充设备数量、在线数量和环境指标。</p>
 */
@Component
public class ProductionPlotClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String productionUrl;

    public ProductionPlotClient(
            @Value("${services.production.url:http://localhost:8092}") String productionUrl) {
        this.productionUrl = productionUrl.replaceAll("/+$", "");
    }

    public List<Map<String, Object>> listCurrentTenantPlots() {
        HttpServletRequest request = currentRequest();
        String authorization = request == null ? null : request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "缺少平台访问令牌");
        }

        URI uri = UriComponentsBuilder.fromHttpUrl(productionUrl + "/api/v1/production/plots")
                .queryParam("pageNum", 1)
                .queryParam("pageSize", 500)
                .build(true)
                .toUri();
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authorization);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    uri, HttpMethod.GET, new HttpEntity<>(headers), Map.class);
            Map<?, ?> body = response.getBody();
            if (body == null || !Integer.valueOf(0).equals(body.get("code"))) {
                String message = body == null ? "生产管理地块接口返回空响应" : String.valueOf(body.get("message"));
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, message);
            }
            Object data = body.get("data");
            if (!(data instanceof Map<?, ?> page)) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "生产管理地块响应结构不正确");
            }
            Object records = page.get("records");
            if (!(records instanceof List<?> list)) {
                return List.of();
            }
            return list.stream()
                    .filter(Map.class::isInstance)
                    .map(Map.class::cast)
                    .map(this::normalize)
                    .toList();
        } catch (ResponseStatusException error) {
            throw error;
        } catch (RestClientException error) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "生产管理地块服务暂时不可用，无法读取地块主数据",
                    error);
        }
    }

    private Map<String, Object> normalize(Map<?, ?> source) {
        Map<String, Object> plot = new LinkedHashMap<>();
        Long id = longValue(source.get("id"));
        Object statusValue = source.get("status");
        Integer productionStatus = intValue(statusValue);
        String cropName = text(source.get("currentCrop"));
        if (cropName == null) cropName = text(source.get("cropVariety"));
        plot.put("id", id);
        plot.put("plotId", id == null ? null : String.valueOf(id));
        plot.put("plotCode", text(source.get("plotCode")));
        plot.put("plotName", text(source.get("plotName")));
        plot.put("farmId", source.get("farmId"));
        plot.put("farmCode", source.get("farmCode"));
        plot.put("farmName", source.get("farmName"));
        plot.put("area", decimal(source.get("area")));
        plot.put("cropName", cropName == null ? "未种植" : cropName);
        plot.put("cropVariety", source.get("cropVariety"));
        plot.put("cropStage", cropStage(productionStatus));
        plot.put("plantingDate", source.get("plantingDate"));
        plot.put("expectedHarvestDate", source.get("expectedHarvestDate"));
        plot.put("latitude", source.get("centerLatitude"));
        plot.put("longitude", source.get("centerLongitude"));
        plot.put("boundary", source.get("boundary"));
        plot.put("productionStatus", productionStatus);
        plot.put("status", Integer.valueOf(0).equals(productionStatus) ? "warning" : "normal");
        plot.put("source", "production");
        plot.put("sourceService", "agri-production");
        plot.put("sourceUpdatedAt", source.get("updateTime"));
        return plot;
    }

    private HttpServletRequest currentRequest() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes == null ? null : attributes.getRequest();
    }

    private static String cropStage(Integer status) {
        if (status == null) return "状态未知";
        return switch (status) {
            case 0 -> "已停用";
            case 1 -> "空闲";
            case 2 -> "在种";
            case 3 -> "采收期";
            case 4 -> "休耕";
            default -> "状态未知";
        };
    }

    private static String text(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        try {
            return value == null ? null : Long.valueOf(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static Integer intValue(Object value) {
        if (value instanceof Number number) return number.intValue();
        try {
            return value == null ? null : Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static BigDecimal decimal(Object value) {
        if (value instanceof BigDecimal decimal) return decimal;
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue());
        try {
            return value == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return BigDecimal.ZERO;
        }
    }
}
