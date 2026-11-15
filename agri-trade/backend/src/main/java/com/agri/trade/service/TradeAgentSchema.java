package com.agri.trade.service;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;

/** 与交易域现有幂等SQL迁移保持一致，失败则阻止启动，避免页面写入不存在的表。 */
@Component
@RequiredArgsConstructor
public class TradeAgentSchema implements ApplicationRunner {
    private final DataSource source;
    @Override public void run(ApplicationArguments args) {
        var p=new ResourceDatabasePopulator(new ClassPathResource("schema-patch-trade-agents.sql"));
        p.setSqlScriptEncoding("UTF-8");p.execute(source);
    }
}
