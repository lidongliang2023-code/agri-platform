package com.agri.satellite.quotepush;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.concurrent.atomic.AtomicLong;

/**
 * 行情轮询器（开发态数据源）：从核心单体行情 API 拉取增量并广播。
 * 生产态升级路径：改为消费 quote.updated 事件（RocketMQ），推送链路不变——推送与数据源解耦。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QuotePoller {

    private final QuoteWebSocketHandler handler;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestClient restClient = RestClient.create();
    private final AtomicLong lastQuoteId = new AtomicLong(0);

    @Value("${agri.push.core-base-url:http://localhost:8080}")
    private String coreBaseUrl;

    @Scheduled(fixedDelayString = "${agri.push.poll-interval-ms:3000}")
    public void poll() {
        try {
            String body = restClient.get()
                    .uri(coreBaseUrl + "/api/v1/quotes?page=1&size=50")
                    .retrieve()
                    .body(String.class);
            if (body == null) {
                return;
            }
            JsonNode records = objectMapper.readTree(body).path("data").path("records");
            for (JsonNode record : records) {
                long id = record.path("id").asLong();
                if (id > lastQuoteId.get()) {
                    lastQuoteId.getAndUpdate(prev -> Math.max(prev, id));
                    String frame = objectMapper.writeValueAsString(java.util.Map.of("type", "quote", "data", record));
                    int sent = handler.broadcast(frame);
                    log.debug("行情推送: id={}, 客户端 {}", id, sent);
                }
            }
        } catch (Exception e) {
            log.warn("行情拉取失败（核心单体不可达或无数据）: {}", e.getMessage());
        }
    }
}
