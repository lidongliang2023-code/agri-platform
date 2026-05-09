package com.agri;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@MapperScan("com.agri.**.mapper")
@EnableFeignClients
public class MasterDataApplication {

    public static void main(String[] args) {
        SpringApplication.run(MasterDataApplication.class, args);
    }
}