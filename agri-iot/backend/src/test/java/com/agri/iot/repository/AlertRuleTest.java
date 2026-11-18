package com.agri.iot.repository;

import com.agri.iot.integration.IotIdentityService;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AlertRuleTest {
 JdbcTemplate jdbc; IotIdentityService identity; IotAlertRuleRepository rules;
 @BeforeEach void setup(){
  jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa",""));
  identity=mock(IotIdentityService.class);when(identity.currentTenantId()).thenReturn(2001L);when(identity.requireOperatorName()).thenReturn("规则测试员");
  jdbc.execute("CREATE TABLE iot_device_type(id BIGINT,type_name VARCHAR(120),property_text VARCHAR(400))");
  jdbc.update("INSERT INTO iot_device_type VALUES(1,'温湿度传感器','temperature,humidity')");
  jdbc.execute("CREATE TABLE iot_alert_rule(id BIGINT AUTO_INCREMENT PRIMARY KEY,rule_name VARCHAR(160),device_type VARCHAR(120),metric_key VARCHAR(40),metric_name VARCHAR(80),operator_text VARCHAR(10),threshold_value VARCHAR(40),duration_seconds INT,level_name VARCHAR(20),enabled BOOLEAN,tenant_scope VARCHAR(120))");
  jdbc.execute("CREATE TABLE iot_alert_rule_tenant(id BIGINT AUTO_INCREMENT PRIMARY KEY,tenant_id BIGINT,rule_name VARCHAR(160),device_type VARCHAR(120),metric_key VARCHAR(40),metric_name VARCHAR(80),operator_text VARCHAR(10),threshold_value VARCHAR(40),duration_seconds INT,level_name VARCHAR(20),enabled BOOLEAN,remark VARCHAR(400),source_rule_id BIGINT,created_by VARCHAR(80),updated_by VARCHAR(80),created_at VARCHAR(40),updated_at VARCHAR(40))");
  jdbc.execute("CREATE TABLE iot_ops_log(id BIGINT AUTO_INCREMENT PRIMARY KEY,operator_name VARCHAR(80),action_name VARCHAR(120),target_name VARCHAR(200),detail_text VARCHAR(1000),ip_address VARCHAR(60),created_at VARCHAR(40))");
  rules=new IotAlertRuleRepository(jdbc,identity);
 }
 Map<String,Object> body(){return new HashMap<>(Map.of("ruleName","测试高温","metricKey","temperature","operator",">","threshold",32,"durationSeconds",0,"level","major","enabled",true));}
 long create(){return ((Number)rules.createTenantRule(body()).get("id")).longValue();}
 @Test void invalidDurationsAreRejected(){for(Object value:List.of(0.5,1.5,-0.5,"abc","1.2",true,86401,-1)){var b=body();b.put("durationSeconds",value);assertThrows(IllegalArgumentException.class,()->rules.createTenantRule(b),String.valueOf(value));}}
 @Test void durationEndpointsAccepted(){for(Object value:List.of(0,86400,"300")){var b=body();b.put("durationSeconds",value);assertEquals(Integer.parseInt(value.toString()),((Number)rules.createTenantRule(b).get("durationSeconds")).intValue());}}
 @Test void toggleAuditExplainsActualResult(){long id=create();assertEquals(false,rules.toggleTenantRule(id).get("enabled"));assertEquals("停用后该指标回落到平台预置阈值",jdbc.queryForObject("SELECT detail_text FROM iot_ops_log ORDER BY id DESC LIMIT 1",String.class));assertEquals(true,rules.toggleTenantRule(id).get("enabled"));assertEquals("按本主体阈值判定",jdbc.queryForObject("SELECT detail_text FROM iot_ops_log ORDER BY id DESC LIMIT 1",String.class));}
 @Test void createEditDeleteAndIdentity(){long id=create();assertEquals("规则测试员",rules.tenantRules().get(0).get("createdBy"));var b=body();b.put("threshold",-2.5);rules.updateTenantRule(id,b);assertEquals(new BigDecimal("-2.5"),rules.tenantRules().get(0).get("threshold"));rules.deleteTenantRule(id);assertTrue(rules.tenantRules().isEmpty());verify(identity,atLeastOnce()).requireTenantRow("iot_alert_rule_tenant",id,"阈值规则");}
 @Test void forbiddenTenantMutationDoesNotWrite(){long id=create();doThrow(new IllegalArgumentException("非当前主体")).when(identity).requireTenantRow("iot_alert_rule_tenant",id,"阈值规则");assertThrows(IllegalArgumentException.class,()->rules.updateTenantRule(id,body()));assertThrows(IllegalArgumentException.class,()->rules.toggleTenantRule(id));assertThrows(IllegalArgumentException.class,()->rules.deleteTenantRule(id));assertEquals(1,rules.tenantRules().size());}
 @Test void invalidRuleFieldsRejected(){for(var change:List.of(Map.of("ruleName"," "),Map.of("metricKey","unknown"),Map.of("operator","="),Map.of("level","bad"),Map.of("deviceType","不存在"),Map.of("threshold","NaN"),Map.of("remark","长".repeat(401)))){var b=body();b.putAll(change);assertThrows(IllegalArgumentException.class,()->rules.createTenantRule(b));}}
 @Test void enabledOverrideAndFallback(){rules.createPlatformRule(body());var b=body();b.put("threshold",30);long id=((Number)rules.createTenantRule(b).get("id")).longValue();assertEquals(1,rules.effectiveRules().size());assertTrue((Boolean)rules.evaluate(Map.of("metricKey","temperature","value",31)).get("breached"));rules.toggleTenantRule(id);assertEquals("platform",rules.effectiveRules().get(0).get("source"));assertFalse((Boolean)rules.evaluate(Map.of("metricKey","temperature","value",31)).get("breached"));rules.deleteTenantRule(id);assertEquals(1,rules.effectiveRules().size());}
 @Test void fourComparisonBoundaries(){for(String op:List.of(">",">=","<","<=")){var b=body();b.put("operator",op);long id=((Number)rules.createTenantRule(b).get("id")).longValue();assertEquals(op.contains("="),rules.evaluate(Map.of("metricKey","temperature","value",32)).get("breached"));rules.deleteTenantRule(id);}assertThrows(IllegalArgumentException.class,()->rules.evaluate(Map.of("metricKey","temperature","value","NaN")));}
 @Test void sustainedWindowRequiresEvidence(){var readings=List.<Map<String,Object>>of(Map.of("value",33,"recordedAt","2026-11-18 10:00:00"),Map.of("value",34,"recordedAt","2026-11-18 10:01:00"));assertTrue(IotAlertRuleRepository.durationSustained(readings,"2026-11-18 10:01:00",60,">",new BigDecimal("32")));assertFalse(IotAlertRuleRepository.durationSustained(readings,"2026-11-18 10:01:00",120,">",new BigDecimal("32")));assertFalse(IotAlertRuleRepository.durationSustained(List.of(),"2026-11-18 10:01:00",60,">",new BigDecimal("32")));}
}
