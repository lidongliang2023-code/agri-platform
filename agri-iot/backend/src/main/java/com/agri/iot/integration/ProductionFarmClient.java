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

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * 生产管理农场主数据客户端。
 *
 * <p>IoT 设备注册不再接受前端任意 farmId / tenantId。当前登录租户可用农场与
 * 农场归属租户均取生产管理接口，设备落库时保存同一份标识。</p>
 */
@Component
public class ProductionFarmClient {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String productionUrl;

    public ProductionFarmClient(
            @Value("${services.production.url:http://localhost:8092}") String productionUrl) {
        this.productionUrl = productionUrl.replaceAll("/+$", "");
    }

    public List<Map<String, Object>> listCurrentTenantFarms() {
        HttpServletRequest request = currentRequest();
        String authorization = request == null ? null : request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "缺少平台访问令牌");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, authorization);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    productionUrl + "/api/v1/production/farms/all",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    Map.class);
            Map<?, ?> body = response.getBody();
            if (body == null || !Integer.valueOf(0).equals(body.get("code"))) {
                String message = body == null ? "生产管理农场接口返回空响应" : String.valueOf(body.get("message"));
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, message);
            }
            if (!(body.get("data") instanceof List<?> records)) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "生产管理农场响应结构不正确");
            }
            return records.stream()
                    .filter(Map.class::isInstance)
                    .map(Map.class::cast)
                    .map(this::normalize)
                    .toList();
        } catch (ResponseStatusException error) {
            throw error;
        } catch (RestClientException error) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "生产管理农场服务暂时不可用，无法校验农场和租户",
                    error);
        }
    }

    public Map<String, Object> requireCurrentTenantFarm(long farmId) {
        return listCurrentTenantFarms().stream()
                .filter(farm -> longValue(farm.get("id")) == farmId)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("所选农场不属于当前生产管理租户"));
    }

    private Map<String, Object> normalize(Map<?, ?> source) {
        Map<String, Object> farm = new LinkedHashMap<>();
        Long id = longValue(source.get("id"));
        farm.put("id", id);
        farm.put("farmId", id == null ? null : String.valueOf(id));
        farm.put("farmCode", text(source.get("farmCode")));
        farm.put("farmName", text(source.get("farmName")));
        farm.put("tenantId", text(source.get("tenantId")));
        farm.put("managerName", text(source.get("managerName")));
        farm.put("managerPhone", text(source.get("managerPhone")));
        farm.put("address", farmAddress(source));
        farm.put("province", text(source.get("province")));
        farm.put("city", text(source.get("city")));
        farm.put("district", text(source.get("district")));
        farm.put("totalArea", decimal(source.get("totalArea")));
        farm.put("plotCount", source.get("plotCount"));
        farm.put("status", source.get("status"));
        farm.put("source", "production");
        return farm;
    }

    /**
     * 农场地址：生产端演示数据大多只填了省市区，详细 address 是空的。
     * 直接取 address 会让物联网工作台显示 "null · 1280 亩"，所以退回按省市区拼接。
     */
    private static String farmAddress(Map<?, ?> source) {
        String detail = text(source.get("address"));
        if (detail != null) {
            return detail;
        }
        String region = Stream.of(source.get("province"), source.get("city"), source.get("district"))
                .map(ProductionFarmClient::text)
                .filter(java.util.Objects::nonNull)
                .reduce((left, right) -> left + right)
                .orElse("");
        return region.isEmpty() ? null : region;
    }

    private HttpServletRequest currentRequest() {
        ServletRequestAttributes attributes =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        return attributes == null ? null : attributes.getRequest();
    }

    private static long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return -1L;
        }
    }

    private static String text(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
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
