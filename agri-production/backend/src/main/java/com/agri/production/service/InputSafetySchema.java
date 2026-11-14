package com.agri.production.service;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/** 幂等安装投入品推荐与安全校验域的新表；不修改库存和使用台账历史。 */
@Component
public class InputSafetySchema implements ApplicationRunner {
    private final DataSource dataSource;
    public InputSafetySchema(DataSource dataSource) { this.dataSource = dataSource; }
    @Override public void run(ApplicationArguments args) {
        var populator = new ResourceDatabasePopulator(new ClassPathResource("schema-patch-input-safety.sql"));
        populator.setSqlScriptEncoding("UTF-8");
        populator.execute(dataSource);
        var jdbc = new org.springframework.jdbc.core.JdbcTemplate(dataSource);
        for (String table : java.util.List.of("agri_prod_input_safety_rule", "agri_prod_input_restriction", "agri_prod_input_compatibility")) {
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name='evidence_json'", Integer.class, table);
            if (count != null && count == 0) jdbc.execute("ALTER TABLE " + table + " ADD COLUMN evidence_json LONGTEXT NULL");
        }
    }
}
