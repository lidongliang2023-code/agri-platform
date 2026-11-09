package com.agri.s2b2c;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = {"com.agri.s2b2c", "com.agri.common.ai"})
@EnableScheduling
public class S2B2CApplication {
    public static void main(String[] args) {
        SpringApplication.run(S2B2CApplication.class, args);
    }
}