package com.agri.government;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {"com.agri"})
public class GovernmentApplication {
    public static void main(String[] args) {
        SpringApplication.run(GovernmentApplication.class, args);
    }
}
