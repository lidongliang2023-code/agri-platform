package com.agri.satellite.iot;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * IoT 接入服务（卫星）：万台级 MQTT 长连接独立部署伸缩（ADR-002）。
 * 复用核心基础设施（事件总线/统一响应），数据表前缀 iot_，独立数据库 agri_iot。
 */
@EnableScheduling
@MapperScan("com.agri.core.infra")
@ComponentScan(basePackages = {"com.agri.satellite.iot", "com.agri.core.infra"})
@SpringBootApplication
public class IotAccessApplication {

    public static void main(String[] args) {
        SpringApplication.run(IotAccessApplication.class, args);
    }
}
