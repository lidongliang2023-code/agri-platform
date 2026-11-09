package com.agri.s2b2c.integration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 生产域溯源客户端：商品详情的种植-采收-加工链路只从这里取，商城不自存副本。
 *
 * <p><b>为什么不自存</b>：{@code s2b2c_traceability} 此前是全平台唯一"看起来有溯源"的数据源，
 * 而它只有建库脚本灌进去的两行演示数据、全仓没有任何写入方 —— 生产域登记的真实链路一条也到不了消费者。
 * 副本存在的每一天都在制造"页面有内容、内容是假的"这种最难发现的故障。</p>
 *
 * <p><b>不可达必须显式失败</b>：连不上时返回空列表，页面会显示"该商品暂无溯源批次"，
 * 用户读到的是"这个批次没记录"，而真相是"链路断了"。两个结论对消费者的意义完全相反，
 * 所以这里把连接失败、非 2xx、结构不对都抛成 {@link ProductionTraceUnavailableException}。</p>
 */
@Component
public class ProductionTraceClient {

    private final String baseUrl;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();

    public ProductionTraceClient(@Value("${services.production.url:http://localhost:8092}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    /**
     * 批次级公开核验视图（免登录、跨主体）：节点、链上结论与本批次的码清单。
     *
     * @param authorization 调用方令牌；公开端点本身不需要，带上是为了与属主视图同一口径
     * @return 出参；生产域回 404（查无此批次）时返回 {@code null}
     * @throws ProductionTraceUnavailableException 链路不可用（服务停了、非 2xx、结构不对）
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> batchTrace(String batchNo, String authorization) {
        String path = "/api/v1/production/trace/public/batch/"
                + URLEncoder.encode(batchNo == null ? "" : batchNo.trim(), StandardCharsets.UTF_8);
        Map<String, Object> body = call(path, authorization, false);
        if (body == null) {
            return null;
        }
        Object data = body.get("data");
        return data instanceof Map ? (Map<String, Object>) data : null;
    }

    /**
     * 按**溯源码**的公开核验视图（免登录、跨主体）：消费者手上有码时用这条。
     *
     * @return 出参；生产域回 404（查无此码）时返回 {@code null}
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> codeTrace(String code, String authorization) {
        String path = "/api/v1/production/trace/public/verify/"
                + URLEncoder.encode(code == null ? "" : code.trim(), StandardCharsets.UTF_8);
        Map<String, Object> body = call(path, authorization, false);
        if (body == null) {
            return null;
        }
        Object data = body.get("data");
        return data instanceof Map ? (Map<String, Object>) data : null;
    }

    /**
     * 调用方所属经营主体名下的采收批次（供应商绑定商品时的候选列表）。
     *
     * <p>这一步同时是<b>归属校验</b>：按调用方令牌向生产域要批次，生产域只回它自己的。
     * 于是"把自家商品挂到别人真实链路上"这种绑定根本选不出来，也不需要另写一段越权判断。</p>
     */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> myBatches(String keyword, String authorization) {
        String path = "/api/v1/production/harvests?page=1&size=100"
                + (keyword == null || keyword.isBlank() ? ""
                : "&batchNo=" + URLEncoder.encode(keyword.trim(), StandardCharsets.UTF_8));
        Map<String, Object> body = call(path, authorization, true);
        Object data = body == null ? null : body.get("data");
        if (data instanceof Map) {
            Object records = ((Map<String, Object>) data).get("records");
            if (records instanceof List) {
                return (List<Map<String, Object>>) records;
            }
            Object list = ((Map<String, Object>) data).get("list");
            if (list instanceof List) {
                return (List<Map<String, Object>>) list;
            }
        }
        throw new ProductionTraceUnavailableException("生产域批次列表响应结构不对（期望 data.records 数组）");
    }

    /**
     * 发一次请求并解开 {@code ApiResponse} 外壳。
     *
     * @param requireSuccess 未命中是否必须报错（绑定校验要报错；公开查询允许按 404 回 null）
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> call(String path, String authorization, boolean requireSuccess) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(6))
                .GET();
        if (authorization != null && !authorization.isBlank()) {
            builder.header("Authorization", authorization.startsWith("Bearer ")
                    ? authorization : "Bearer " + authorization);
        }
        HttpResponse<String> response;
        try {
            response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (java.io.IOException e) {
            throw new ProductionTraceUnavailableException(
                    "生产管理模块不可达（" + baseUrl + "），溯源链路无法展示：" + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ProductionTraceUnavailableException("查询生产域溯源链路被中断，请重试");
        }
        if (response.statusCode() == 404 && !requireSuccess) {
            return null;
        }
        if (response.statusCode() / 100 != 2) {
            throw new ProductionTraceUnavailableException("生产域溯源接口返回 HTTP "
                    + response.statusCode() + "，链路不可用（这不等于该商品没有溯源记录）");
        }
        Map<String, Object> body;
        try {
            body = mapper.readValue(response.body(), Map.class);
        } catch (Exception e) {
            throw new ProductionTraceUnavailableException("生产域溯源接口响应不是可解析的 JSON：" + e.getMessage());
        }
        Object code = body.get("code");
        // 生产域的成功码是 0（监管端才是 200），跨域判成功不能按 200 比
        if (code instanceof Number && ((Number) code).intValue() != 0) {
            if (!requireSuccess) {
                return null;
            }
            throw new ProductionTraceUnavailableException("生产域未返回该批次链路：" + body.get("message"));
        }
        return body;
    }
}
