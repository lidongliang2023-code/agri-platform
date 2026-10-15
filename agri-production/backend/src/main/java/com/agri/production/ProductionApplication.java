package com.agri.production;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.agri.production.mapper")
@EnableFeignClients
// 领域事件中继（DomainEventRelay）用 @Scheduled 轮询 outbox，没有这个注解调度器不启动 ——
// 表现为"事件一直停在 NEW、日志里一句都不说"，很难从现象倒推到注解缺失。
@EnableScheduling
public class ProductionApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProductionApplication.class, args);
    }
}
