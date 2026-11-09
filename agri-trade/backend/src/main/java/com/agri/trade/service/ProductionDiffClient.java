package com.agri.trade.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.util.UriComponentsBuilder;
import java.time.Duration;

/** 只读查询生产工单，不跨域直连数据库，不修改生产事实。 */
@Component
public class ProductionDiffClient {
    private final RestTemplate rest;
    private final String base;
    public ProductionDiffClient(RestTemplateBuilder builder, @Value("${services.production.url:http://localhost:8092}") String base) {
        rest = builder.setConnectTimeout(Duration.ofSeconds(3)).setReadTimeout(Duration.ofSeconds(8)).build();
        this.base = base.replaceAll("/+$", "");
    }
    public JsonNode requirement(String ticketNo, Long subjectId) {
        var ctx = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        String auth = ctx == null ? null : ctx.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
        if (auth == null || auth.isBlank()) throw new IllegalArgumentException("缺少登录凭据");
        HttpHeaders headers = new HttpHeaders(); headers.set(HttpHeaders.AUTHORIZATION, auth);
        headers.set("X-Merchant-Id", String.valueOf(subjectId));
        var uri = UriComponentsBuilder.fromHttpUrl(base + "/api/v1/production/p2t/diffs/reship-requirement")
                .queryParam("ticketNo", ticketNo).build().encode().toUri();
        JsonNode body = rest.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class).getBody();
        if (body == null || body.path("code").asInt() != 200 || !body.path("data").isObject())
            throw new IllegalArgumentException("工单未满足补发登记条件");
        return body.path("data");
    }
}
