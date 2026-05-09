package com.agri.iot;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@MapperScan("com.agri.iot.mapper")
@EnableFeignClients
@EnableAsync
public class IoTApplication {

    public static void main(String[] args) {
        SpringApplication.run(IoTApplication.class, args);
    }
}