package com.agri.satellite.quotepush;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.socket.config.annotation.EnableWebSocket;

/**
 * 行情推送服务（卫星）：WebSocket 长连接，与核心单体物理隔离、独立伸缩（ADR-002）。
 */
@EnableScheduling
@EnableWebSocket
@SpringBootApplication
public class QuotePushApplication {

    public static void main(String[] args) {
        SpringApplication.run(QuotePushApplication.class, args);
    }
}
