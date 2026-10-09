package com.agri.satellite.gov;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * 政务交换前置（卫星，ADR-006）：部署于政务云专区。
 * 职责：接收核心侧监管数据 → 落审计 → 单向导出目录（由网闸/摆渡程序单向导入政务内网）。
 * 本服务永不主动回连公有云 —— 数据流向单向、可审计。
 */
@MapperScan("com.agri.core.infra")
@ComponentScan(basePackages = {"com.agri.satellite.gov", "com.agri.core.infra"})
@SpringBootApplication
public class GovExchangeApplication {

    public static void main(String[] args) {
        SpringApplication.run(GovExchangeApplication.class, args);
    }
}
