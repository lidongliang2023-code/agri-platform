package com.agri.production.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
public class YieldForecastSchema implements ApplicationRunner {
    private final DataSource dataSource;
    public YieldForecastSchema(DataSource dataSource) { this.dataSource = dataSource; }
    @Override public void run(ApplicationArguments args) {
        var populator = new ResourceDatabasePopulator(new ClassPathResource("schema-patch-yield-forecast.sql"));
        populator.setSqlScriptEncoding("UTF-8");
        populator.execute(dataSource);
    }
}
