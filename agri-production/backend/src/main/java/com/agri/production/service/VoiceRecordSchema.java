package com.agri.production.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;

@Component
public class VoiceRecordSchema implements ApplicationRunner {
    private final DataSource source;
    public VoiceRecordSchema(DataSource source) { this.source=source; }
    public void run(ApplicationArguments args) {
        var installer=new ResourceDatabasePopulator(new ClassPathResource("schema-patch-voice-farm-record.sql"));
        installer.setSqlScriptEncoding("UTF-8"); installer.execute(source);
    }
}
