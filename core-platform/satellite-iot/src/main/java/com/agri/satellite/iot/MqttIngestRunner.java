package com.agri.satellite.iot;

import com.agri.core.infra.util.JsonUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Map;

/**
 * MQTT 接入通道（EMQX，MQTT 5.0）：订阅设备上行主题，断线自动重连。
 * 主题约定：agri/devices/{marketId}/{deviceNo}，payload JSON {metric, value}。
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "agri.iot.mqtt.enabled", havingValue = "true")
public class MqttIngestRunner implements ApplicationRunner {

    private final IngestService ingestService;

    @Value("${agri.iot.mqtt.broker:tcp://localhost:1883}")
    private String broker;

    @Value("${agri.iot.mqtt.topic-filter:agri/devices/#}")
    private String topicFilter;

    @Value("${agri.iot.mqtt.client-id:agri-iot-ingest}")
    private String clientId;

    @Value("${agri.iot.mqtt.username:}")
    private String username;

    @Value("${agri.iot.mqtt.password:}")
    private String password;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        MqttClient client = new MqttClient(broker, clientId, new MemoryPersistence());
        MqttConnectOptions options = new MqttConnectOptions();
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        options.setUserName(username.isEmpty() ? null : username);
        options.setPassword(password.isEmpty() ? null : password.toCharArray());
        client.connect(options);
        client.subscribe(topicFilter, (topic, message) -> {
            try {
                Map<?, ?> body = JsonUtil.MAPPER.readValue(message.getPayload(), Map.class);
                String deviceNo = String.valueOf(body.get("deviceNo"));
                String metric = String.valueOf(body.get("metric"));
                BigDecimal value = new BigDecimal(String.valueOf(body.get("value")));
                Long marketId = body.get("marketId") == null ? null : Long.valueOf(String.valueOf(body.get("marketId")));
                ingestService.ingest(deviceNo, metric, value, marketId);
            } catch (Exception e) {
                log.error("MQTT 消息处理失败: topic={}, {}", topic, e.getMessage());
            }
        });
        log.info("MQTT 订阅已建立: broker={}, filter={}", broker, topicFilter);
    }
}
