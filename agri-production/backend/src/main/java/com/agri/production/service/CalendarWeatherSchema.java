package com.agri.production.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
public class CalendarWeatherSchema implements ApplicationRunner {
    private final DataSource dataSource;
    public CalendarWeatherSchema(DataSource dataSource) { this.dataSource = dataSource; }
    @Override public void run(ApplicationArguments args) {
        ResourceDatabasePopulator installer = new ResourceDatabasePopulator(
                new ClassPathResource("schema-patch-calendar-weather.sql"));
        installer.setSqlScriptEncoding("UTF-8");
        installer.execute(dataSource);
    }
}
