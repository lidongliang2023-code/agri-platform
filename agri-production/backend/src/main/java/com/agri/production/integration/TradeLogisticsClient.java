package com.agri.production.integration;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.util.UriComponentsBuilder;
import java.time.Duration;

/** 交易域拥有物流事实；生产端只按当前主体和已校验的供给单只读查询。 */
@Component
public class TradeLogisticsClient {
    private final RestTemplate rest;
    private final String base;
    public TradeLogisticsClient(RestTemplateBuilder builder,
            @Value("${services.trade.url:http://localhost:8089}") String base) {
        rest = builder.setConnectTimeout(Duration.ofSeconds(3)).setReadTimeout(Duration.ofSeconds(8)).build();
        this.base = base.replaceAll("/+$", "");
    }
    public void verifyDiffRefund(String offerNo, String orderNo, String refundNo, String subject) {
        ServletRequestAttributes context = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        String auth = context == null ? null : context.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
        if (auth == null || auth.isBlank()) throw new BusinessException(401, "缺少登录凭证，无法核验退款");
        JsonNode body;
        try {
            HttpHeaders headers = new HttpHeaders(); headers.set(HttpHeaders.AUTHORIZATION, auth);
            var uri = UriComponentsBuilder.fromHttpUrl(base + "/api/trade/diff-evidence/refund")
                    .queryParam("offerNo", offerNo).queryParam("orderNo", orderNo)
                    .queryParam("refundNo", refundNo).queryParam("subjectId", subject).build().encode().toUri();
            body = rest.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class).getBody();
        } catch (Exception e) { throw new BusinessException(503, "交易退款核验暂不可用，工单未关闭，请重试"); }
        if (body == null || body.path("code").asInt() != 200 || !body.path("data").path("verified").asBoolean(false))
            throw new BusinessException(400, "退款凭据未通过核验：请确认主体、供给、订单关联及全额退款记账结果");
    }

    public void verifyDiffReship(String offerNo, String orderNo, String ticketNo, String logisticsNo,
                                 java.math.BigDecimal quantity, String unit, String subject) {
        ServletRequestAttributes context = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        String auth = context == null ? null : context.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
        if (auth == null || auth.isBlank()) throw new BusinessException(401, "缺少登录凭证，无法核验补发");
        JsonNode body;
        try {
            HttpHeaders headers = new HttpHeaders(); headers.set(HttpHeaders.AUTHORIZATION, auth);
            var uri = UriComponentsBuilder.fromHttpUrl(base + "/api/trade/diff-evidence/reship")
                    .queryParam("offerNo", offerNo).queryParam("orderNo", orderNo).queryParam("ticketNo", ticketNo)
                    .queryParam("logisticsNo", logisticsNo).queryParam("quantity", quantity).queryParam("unit", unit)
                    .queryParam("subjectId", subject).build().encode().toUri();
            body = rest.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class).getBody();
        } catch (Exception e) { throw new BusinessException(503, "交易补发核验暂不可用，工单未关闭，请重试"); }
        if (body == null || body.path("code").asInt() != 200 || !body.path("data").path("verified").asBoolean(false))
            throw new BusinessException(400, "补发凭据未通过核验：请确认工单、供给、订单、数量、单位及买方签收结果");
    }

    public JsonNode byOffer(String offerNo, String subject) {
        ServletRequestAttributes context = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        String auth = context == null ? null : context.getRequest().getHeader(HttpHeaders.AUTHORIZATION);
        if (auth == null || auth.isBlank()) throw new BusinessException(401, "缺少登录凭证，无法读取大宗物流");
        JsonNode body;
        try {
            HttpHeaders headers = new HttpHeaders(); headers.set(HttpHeaders.AUTHORIZATION, auth);
            var uri = UriComponentsBuilder.fromHttpUrl(base + "/api/trade/logistics/trace-chain/by-offer")
                    .queryParam("offerNo", offerNo).queryParam("subjectId", subject).build().encode().toUri();
            body = rest.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), JsonNode.class).getBody();
        } catch (HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            throw new BusinessException(status == 401 || status == 403 ? status : 503,
                    status == 401 || status == 403 ? "交易物流查询未获授权，请核对登录及主体权限" : "交易物流服务暂不可用，请重试");
        } catch (Exception e) { throw new BusinessException(503, "交易物流服务暂不可用，请重试"); }
        if (body == null || !body.path("code").isIntegralNumber()) throw new BusinessException(503, "交易物流返回格式异常");
        int status = body.path("code").asInt();
        if (status != 200) throw new BusinessException(status == 401 || status == 403 ? status : 503,
                body.path("message").asText("交易物流查询失败"));
        if (!body.path("data").isArray()) throw new BusinessException(503, "交易物流返回格式异常");
        return body.path("data");
    }
}
