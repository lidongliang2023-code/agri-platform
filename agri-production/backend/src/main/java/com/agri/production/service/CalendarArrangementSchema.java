package com.agri.production.service;

import org.springframework.stereotype.Component;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import javax.sql.DataSource;

@Component
public class CalendarArrangementSchema implements ApplicationRunner {
    private final DataSource dataSource;
    public CalendarArrangementSchema(DataSource dataSource) {this.dataSource=dataSource;}
    @Override public void run(ApplicationArguments args) {
        var installer=new ResourceDatabasePopulator(new ClassPathResource("schema-patch-calendar-arrangement.sql"));
        installer.setSqlScriptEncoding("UTF-8");installer.execute(dataSource);
    }
}
