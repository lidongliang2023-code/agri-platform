package com.agri.production.service;

import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

/** 幂等安装病例表；只创建本域新表，不修改存量记录。失败则阻止服务带缺表运行。 */
@Component
public class PestDiagnosisSchema implements ApplicationRunner {
    private final DataSource dataSource;
    public PestDiagnosisSchema(DataSource dataSource) { this.dataSource=dataSource; }
    @Override public void run(ApplicationArguments args) {
        var populator=new ResourceDatabasePopulator(new ClassPathResource("schema-patch-pest-diagnosis.sql"),new ClassPathResource("schema-patch-pest-atlas.sql"));
        populator.setSqlScriptEncoding("UTF-8");
        populator.execute(dataSource);
    }
}
