package com.agri.satellite.ai;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * AI 推理网关（卫星，ADR-008）：换模型不改业务代码、成本可核算、敏感数据可路由本地推理。
 */
@MapperScan("com.agri.core.infra")
@ComponentScan(basePackages = {"com.agri.satellite.ai", "com.agri.core.infra"})
@SpringBootApplication
public class AiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiGatewayApplication.class, args);
    }
}
