package com.agri.core.infra.event;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * HTTP 事件传输（开发态跨进程通道）：卫星服务把事件投递到核心单体的 /internal/events 入口。
 * 生产环境切换 rocketmq（agri.event.transport=rocketmq），事件契约与业务代码不变。
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "agri.event.transport", havingValue = "http")
public class HttpEventTransport implements EventTransport {

    private final List<String> targets;
    private final String internalToken;
    private final RestClient restClient = RestClient.create();

    public HttpEventTransport(
            @Value("${agri.event.http.targets:http://localhost:8080}") List<String> targets,
            @Value("${agri.event.http.internal-token:dev-internal-token}") String internalToken) {
        this.targets = targets;
        this.internalToken = internalToken;
    }

    @Override
    public void publish(DomainEvent event) {
        for (String target : targets) {
            restClient.post()
                    .uri(target + "/internal/events/" + event.getTopic())
                    .header("X-Internal-Token", internalToken)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(event.getPayload())
                    .retrieve()
                    .toBodilessEntity();
            log.debug("[{}] 事件 {} 已投递至 {}", event.getEventId(), event.getTopic(), target);
        }
    }
}
