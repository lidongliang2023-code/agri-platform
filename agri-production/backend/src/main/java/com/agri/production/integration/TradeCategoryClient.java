package com.agri.production.integration;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/** 交易服务是品类唯一来源；使用调用者平台凭证实时核验，不缓存放行结果。 */
@Component
public class TradeCategoryClient {
    private final RestTemplate rest;
    private final String baseUrl;

    public TradeCategoryClient(RestTemplateBuilder builder,
            @Value("${services.trade.url:http://localhost:8089}") String baseUrl) {
        this.rest = builder.setConnectTimeout(Duration.ofSeconds(3))
                .setReadTimeout(Duration.ofSeconds(8)).build();
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    public record Category(String code, String name) {}

    public Category requireEnabled(String input) {
        if (input == null || input.isBlank()) throw new BusinessException(400, "交易品类码不能为空");
        String code = input.trim();
        ServletRequestAttributes context = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        String authorization = context == null ? null : context.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || authorization.isBlank()) {
            throw new BusinessException(401, "缺少登录凭证，无法核验交易品类");
        }
        JsonNode body;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, authorization);
            body = rest.exchange(baseUrl + "/api/trade/product/category/list", HttpMethod.GET,
                    new HttpEntity<>(headers), JsonNode.class).getBody();
        } catch (Exception ex) {
            throw new BusinessException(503, "交易品类字典暂不可用，请稍后重试");
        }
        if (body == null || !body.path("code").isIntegralNumber() || body.path("code").asInt() != 200
                || !body.path("data").isArray()) {
            throw new BusinessException(503, "交易品类字典返回异常，请稍后重试");
        }
        List<JsonNode> matches = new ArrayList<>();
        for (JsonNode row : body.path("data")) {
            if (row.path("categoryCode").isTextual()
                    && code.equals(row.path("categoryCode").asText().trim())) matches.add(row);
        }
        if (matches.isEmpty()) throw new BusinessException(400, "交易品类不存在、已停用或已删除，请重新选择");
        if (matches.size() != 1) throw new BusinessException(400, "交易品类编码重复，请联系交易端维护字典");
        JsonNode row = matches.get(0);
        if (!row.path("status").isIntegralNumber() || row.path("status").asInt() != 1
                || !row.path("delFlag").isIntegralNumber() || row.path("delFlag").asInt() != 0) {
            throw new BusinessException(400, "交易品类已停用或已删除，请重新选择");
        }
        String name = row.path("categoryName").isTextual() ? row.path("categoryName").asText().trim() : "";
        if (name.isEmpty()) throw new BusinessException(400, "交易品类名称缺失，请联系交易端维护字典");
        return new Category(row.path("categoryCode").asText().trim(), name);
    }
}
