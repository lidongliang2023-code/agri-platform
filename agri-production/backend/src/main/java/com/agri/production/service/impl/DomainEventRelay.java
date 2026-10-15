package com.agri.production.service.impl;

import com.agri.production.entity.DomainEventRecord;
import com.agri.production.mapper.DomainEventMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * 领域事件中继：把 {@code agri_prod_domain_event} 里 {@code status=NEW} 的事件投给接收端。
 *
 * <p><b>投递口径（与平台 core-infra 的 outbox 一致）</b>：NEW → （投递成功）SENT；
 * 失败按指数退避重试，次数用尽转 DEAD（死信，可用运营端 replay 重放）。
 * 事件契约、payload 形状都不变 —— 中继只负责"送出去"这一环。</p>
 *
 * <p><b>为什么不用平台的 {@code HttpEventTransport} 直接抄一份</b>：它只看 HTTP 状态码，
 * 而平台事件入口在**没有匹配监听器**时返回的是 <b>HTTP 200 + body {@code code=404}</b>
 * （2026-10-15 实测 8093：{@code POST /internal/events/prod.trace.activated} → {@code {"code":404,"message":"资源不存在"}}）。
 * 照抄就会把"没人接"记成"已投递"—— 那是谎报。这里多解析一层业务码：
 * <b>只有接收端明确 {@code code == 0} 才算投递成功</b>；{@code code=404} 视为失败并原样记录原因，
 * 这样"生产域事件还没有消费方"这件事会**停在状态栏里**，而不是消失在日志里。</p>
 *
 * <p><b>关闭态是显式的</b>：{@code agri.event.transport=none} 时中继一行都不投、状态也不改，
 * 事件原样停在 NEW —— 不会出现"看起来在投，其实没投"。</p>
 */
@Slf4j
@Component
public class DomainEventRelay {

    private static final String TRANSPORT_HTTP = "http";
    /** 平台事件入口的路径（core-infra InternalEventIngressController） */
    private static final String INGRESS_PATH = "/internal/events/";
    private static final int LAST_ERROR_MAX = 400;

    private final DomainEventMapper eventMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .build();

    private final String transport;
    private final String rawTargets;
    private final String internalToken;
    private final int batchSize;
    private final int maxRetry;
    private final long backoffBaseSeconds;

    public DomainEventRelay(
            DomainEventMapper eventMapper,
            @Value("${agri.event.transport:none}") String transport,
            @Value("${agri.event.http.targets:}") String rawTargets,
            @Value("${agri.event.http.internal-token:dev-internal-token}") String internalToken,
            @Value("${agri.event.outbox.batch-size:50}") int batchSize,
            @Value("${agri.event.outbox.max-retry:3}") int maxRetry,
            @Value("${agri.event.outbox.backoff-base-seconds:30}") long backoffBaseSeconds) {
        this.eventMapper = eventMapper;
        this.transport = transport;
        this.rawTargets = rawTargets;
        this.internalToken = internalToken;
        this.batchSize = batchSize;
        this.maxRetry = maxRetry;
        this.backoffBaseSeconds = backoffBaseSeconds;
        log.info("领域事件中继已装配：transport={} targets={} maxRetry={}（关闭态请设 transport=none）",
                transport, targets().isEmpty() ? "未配置" : targets(), maxRetry);
    }

    @Scheduled(fixedDelayString = "${agri.event.outbox.relay-interval-ms:5000}")
    public void relay() {
        if (!TRANSPORT_HTTP.equalsIgnoreCase(transport)) {
            return;
        }
        List<String> targets = targets();
        if (targets.isEmpty()) {
            // 配了 http 却没给 targets：这是配置错误，要说出来，不要静默什么都不做
            log.warn("领域事件中继已启用但未配置接收端（agri.event.http.targets 为空），本轮不投递");
            return;
        }
        List<DomainEventRecord> pending = eventMapper.selectList(new LambdaQueryWrapper<DomainEventRecord>()
                .eq(DomainEventRecord::getStatus, DomainEventRecord.STATUS_NEW)
                .and(w -> w.isNull(DomainEventRecord::getNextRetryAt)
                        .or().le(DomainEventRecord::getNextRetryAt, LocalDateTime.now()))
                .orderByAsc(DomainEventRecord::getId)
                .last("LIMIT " + batchSize));
        for (DomainEventRecord message : pending) {
            deliver(message, targets);
        }
    }

    private void deliver(DomainEventRecord message, List<String> targets) {
        String failure = null;
        for (String target : targets) {
            try {
                failure = post(target, message);
            } catch (Exception e) {
                failure = "投递异常：" + rootMessage(e);
            }
            if (failure != null) {
                break;
            }
        }
        if (failure == null) {
            markSent(message);
        } else {
            markFailed(message, failure);
        }
    }

    /**
     * 投一单。
     *
     * @return {@code null} 表示接收端**确认消费**；否则返回可直接给人看的失败原因
     */
    private String post(String target, DomainEventRecord message) throws Exception {
        String url = (target.endsWith("/") ? target.substring(0, target.length() - 1) : target)
                + INGRESS_PATH + message.getEventType();
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "text/plain; charset=UTF-8")
                .header("X-Internal-Token", internalToken)
                .POST(HttpRequest.BodyPublishers.ofString(
                        message.getPayload() == null ? "{}" : message.getPayload(),
                        StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() / 100 != 2) {
            return "接收端 HTTP " + response.statusCode() + "：" + brief(response.body());
        }
        Integer code = readCode(response.body());
        if (code == null) {
            return "接收端响应不是协议结构（无法确认已被消费）：" + brief(response.body());
        }
        if (code != 0) {
            return "接收端未消费该事件（code=" + code + "）：" + brief(response.body());
        }
        return null;
    }

    private Integer readCode(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(body);
            JsonNode code = node.get("code");
            return code == null || !code.isNumber() ? null : code.asInt();
        } catch (Exception e) {
            return null;
        }
    }

    private void markSent(DomainEventRecord message) {
        int attempts = (message.getRetryCount() == null ? 0 : message.getRetryCount()) + 1;
        eventMapper.update(null, new UpdateWrapper<DomainEventRecord>()
                .eq("id", message.getId())
                .set("status", DomainEventRecord.STATUS_SENT)
                .set("sent_at", LocalDateTime.now())
                .set("retry_count", attempts)
                .set("next_retry_at", null)
                .set("last_error", null));
        log.info("领域事件已投递：{} key={} id={}（第 {} 次尝试）",
                message.getEventType(), message.getEventKey(), message.getId(), attempts);
    }

    private void markFailed(DomainEventRecord message, String reason) {
        int attempts = (message.getRetryCount() == null ? 0 : message.getRetryCount()) + 1;
        boolean dead = attempts >= maxRetry;
        UpdateWrapper<DomainEventRecord> update = new UpdateWrapper<DomainEventRecord>()
                .eq("id", message.getId())
                .set("status", dead ? DomainEventRecord.STATUS_DEAD : DomainEventRecord.STATUS_NEW)
                .set("retry_count", attempts)
                .set("last_error", truncate(reason));
        if (dead) {
            update.set("next_retry_at", null);
            // 死信要说清楚"是投不出去"，不是"消费端处理失败"——后者根本没人接过
            log.error("领域事件投递进入死信：{} key={} id={}，原因：{}（消费端就位后用运营端 replay 重放）",
                    message.getEventType(), message.getEventKey(), message.getId(), reason);
        } else {
            long backoff = backoffBaseSeconds * (1L << attempts);
            update.set("next_retry_at", LocalDateTime.now().plusSeconds(backoff));
            log.warn("领域事件投递失败（第 {} 次，{} 秒后重试）：{} key={}，原因：{}",
                    attempts, backoff, message.getEventType(), message.getEventKey(), reason);
        }
        eventMapper.update(null, update);
    }

    private List<String> targets() {
        if (rawTargets == null || rawTargets.isBlank()) {
            return List.of();
        }
        List<String> list = new ArrayList<>();
        Arrays.stream(rawTargets.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .forEach(list::add);
        return list;
    }

    private static String brief(String body) {
        return truncate(body == null ? "" : body.replaceAll("\\s+", " "));
    }

    private static String truncate(String text) {
        if (text == null) {
            return null;
        }
        return text.length() <= LAST_ERROR_MAX ? text : text.substring(0, LAST_ERROR_MAX);
    }

    private static String rootMessage(Throwable e) {
        Throwable cur = e;
        while (cur.getCause() != null && cur.getCause() != cur) {
            cur = cur.getCause();
        }
        return cur.getClass().getSimpleName() + ": " + cur.getMessage();
    }
}
