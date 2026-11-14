package com.agri.trade.service;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
@Component
public class OfficialMarketPriceSchema implements ApplicationRunner {
 private final DataSource source;
 public OfficialMarketPriceSchema(DataSource source){this.source=source;}
 public void run(ApplicationArguments args){var p=new ResourceDatabasePopulator(new ClassPathResource("schema-patch-official-market-price.sql"));p.setSqlScriptEncoding("UTF-8");p.execute(source);}
}
