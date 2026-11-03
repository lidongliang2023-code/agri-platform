package com.agri;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.agri.**.mapper")
@EnableFeignClients
// 2026-11-02 起本模块有定时任务（权限巡检 PermissionAnomalyJob）；
// 之前没有 @Scheduled 的类所以从未开启，加任务必须同时开启，否则它一次都不会跑。
@EnableScheduling
public class MasterDataApplication {

    public static void main(String[] args) {
        SpringApplication.run(MasterDataApplication.class, args);
    }
}