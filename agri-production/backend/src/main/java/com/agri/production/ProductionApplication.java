package com.agri.production;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@MapperScan("com.agri.production.mapper")
@EnableFeignClients(basePackages = "com.agri.production.feign")
@EnableAsync
public class ProductionApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProductionApplication.class, args);
    }
}