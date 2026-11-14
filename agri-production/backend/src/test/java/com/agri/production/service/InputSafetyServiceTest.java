package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class InputSafetyServiceTest {
    private Map<String,Object> evidence(){return new LinkedHashMap<>(Map.of("validFrom",LocalDate.now().minusDays(1).toString(),"validUntil",LocalDate.now().plusYears(1).toString(),"verifiedOn",LocalDate.now().toString(),"ingredients","测试成分","region","测试属地","sourceVersion","TEST-1"));}
    private Map<String,Object> rule(){var r=new LinkedHashMap<String,Object>();r.putAll(Map.of("registration_no","TEST-REG","input_name","测试品","dosage_unit","克/亩","application_method","喷雾","source","测试依据，不用于生产推荐","source_version","TEST-1","dosage_min",1,"dosage_max",2,"safety_interval_days",7));r.put("_evidence",evidence());return r;}
    @Test void completeEvidencePasses(){assertTrue(InputSafetyService.validRegistration(rule(),LocalDate.now()));}
    @Test void missingRegistrationRejects(){var r=rule();r.remove("registration_no");assertFalse(InputSafetyService.validRegistration(r,LocalDate.now()));}
    @Test void missingDoseRejects(){var r=rule();r.remove("dosage_max");assertFalse(InputSafetyService.validRegistration(r,LocalDate.now()));}
    @Test void missingIntervalRejects(){var r=rule();r.remove("safety_interval_days");assertFalse(InputSafetyService.validRegistration(r,LocalDate.now()));}
    @Test void invalidDoseRejects(){var r=rule();r.put("dosage_min",3);assertFalse(InputSafetyService.validRegistration(r,LocalDate.now()));}
    @Test void expiredRegistrationRejects(){assertFalse(InputSafetyService.validRegistration(rule(),LocalDate.now().plusYears(2)));}
    @Test void missingEvidenceRejects(){var r=rule();r.remove("_evidence");assertFalse(InputSafetyService.validRegistration(r,LocalDate.now()));}
    @Test void demoEvidenceRejects(){var r=rule();r.put("source_version","DEMO-2026");assertFalse(InputSafetyService.validRegistration(r,LocalDate.now()));}
    @Test void futureVerificationRejects(){var r=rule();var e=evidence();e.put("verifiedOn",LocalDate.now().plusDays(1).toString());r.put("_evidence",e);assertFalse(InputSafetyService.validRegistration(r,LocalDate.now()));}
    @Test void freshCataloguePasses(){assertTrue(InputSafetyService.fresh(evidence()));}
    @Test void expiredCatalogueRejects(){var e=evidence();e.put("verifiedOn",LocalDate.now().minusDays(8).toString());assertFalse(InputSafetyService.fresh(e));}
    @Test void futureCatalogueRejects(){var e=evidence();e.put("verifiedOn",LocalDate.now().plusDays(1).toString());assertFalse(InputSafetyService.fresh(e));}
    @Test void catalogueRegionRequired(){var e=evidence();e.remove("region");assertFalse(InputSafetyService.fresh(e));}

    /** 显式启用才连接本机；安装新域表，所有测试业务行在事务内回滚。 */
    @Test void realMysqlLifecycleRollsBack() {
        Assumptions.assumeTrue("true".equals(System.getenv("AGRI_SAFETY_DB_TEST")));
        var ds=new DriverManagerDataSource("jdbc:mysql://localhost:3306/agri_production?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai",System.getenv().getOrDefault("AGRI_DB_USER","root"),System.getenv().getOrDefault("AGRI_DB_PASSWORD","root"));
        new InputSafetySchema(ds).run(null);
        var db=new JdbcTemplate(ds);var service=new InputSafetyService(db,new ObjectMapper().findAndRegisterModules());
        String tenant="SAFETY-TEST-"+UUID.randomUUID();
        new TransactionTemplate(new DataSourceTransactionManager(ds)).executeWithoutResult(tx->{
            tx.setRollbackOnly();
            db.update("INSERT INTO agri_prod_input_material(material_code,material_name,material_type,registration_no,tenant_id,status,deleted) VALUES(?,?,?,?,?,1,0)",tenant,"测试农药A","PESTICIDE","TEST-REG",tenant);
            Long a=db.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
            db.update("INSERT INTO agri_prod_input_material(material_code,material_name,material_type,registration_no,tenant_id,status,deleted) VALUES(?,?,?,?,?,1,0)",tenant+"B","测试农药B","PESTICIDE","TEST-REG-B",tenant);
            Long b=db.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
            var request=new LinkedHashMap<String,Object>(Map.of("requestId",UUID.randomUUID().toString(),"cropName","测试作物","targetName","测试病害","region","测试属地","applicationDate",LocalDate.now().toString(),"harvestDate",LocalDate.now().plusDays(10).toString()));
            assertEquals("REJECTED",service.check(tenant,request,"测试用户").get("state"));
            var reg=rule();reg.remove("_evidence");reg.put("input_id",a.toString());reg.put("crop_name","测试作物");reg.put("target_name","测试病害");reg.put("status","ACTIVE");reg.put("evidence",evidence());
            String ruleId=String.valueOf(service.saveRule(tenant,"registration",reg,"测试用户").get("id"));reg.put("id",ruleId);
            request.put("requestId",UUID.randomUUID().toString());assertEquals("BLOCKED",service.check(tenant,request,"测试用户").get("state"));
            var catalogue=new LinkedHashMap<String,Object>(Map.of("restriction_type","CATALOG","reason","测试完整名录核验","source","测试名录","status","ACTIVE","evidence",evidence()));
            String catalogueId=String.valueOf(service.saveRule(tenant,"restrictions",catalogue,"测试用户").get("id"));catalogue.put("id",catalogueId);
            request.put("requestId",UUID.randomUUID().toString());var passed=service.check(tenant,request,"测试用户");assertEquals("PASSED",passed.get("state"));String recommendationId=String.valueOf(passed.get("id"));
            assertEquals(recommendationId,service.check(tenant,request,"测试用户").get("id"));assertNotNull(service.check(tenant,request,"测试用户").get("recommendations"));
            var altered=new LinkedHashMap<>(request);altered.put("targetName","另一个靶标");assertThrows(BusinessException.class,()->service.check(tenant,altered,"测试用户"));
            assertThrows(BusinessException.class,()->service.detail("OTHER-TENANT",recommendationId));
            request.put("requestId",UUID.randomUUID().toString());request.put("harvestDate",LocalDate.now().plusDays(1).toString());assertEquals("BLOCKED",service.check(tenant,request,"测试用户").get("state"));
            request.remove("harvestDate");request.put("requestId",UUID.randomUUID().toString());assertEquals("BLOCKED",service.check(tenant,request,"测试用户").get("state"));
            request.put("harvestDate",LocalDate.now().plusDays(10).toString());request.put("region","错误属地");request.put("requestId",UUID.randomUUID().toString());assertEquals("BLOCKED",service.check(tenant,request,"测试用户").get("state"));request.put("region","测试属地");
            var compat=Map.<String,Object>of("input_id",a.toString(),"other_input_id",b.toString(),"reason","测试配伍禁忌","source","测试依据","evidence",evidence(),"status","ACTIVE");service.saveRule(tenant,"compatibility",compat,"测试用户");
            request.put("requestId",UUID.randomUUID().toString());assertEquals("PASSED",service.check(tenant,request,"测试用户").get("state"));
            request.put("mixInputIds",List.of(b.toString()));request.put("requestId",UUID.randomUUID().toString());var mixed=service.check(tenant,request,"测试用户");assertEquals("BLOCKED",mixed.get("state"));assertFalse(((List<?>)mixed.get("compatibility")).isEmpty());request.remove("mixInputIds");
            request.put("recentInputIds",List.of(a.toString()));request.put("requestId",UUID.randomUUID().toString());assertEquals("BLOCKED",service.check(tenant,request,"测试用户").get("state"));request.remove("recentInputIds");
            var forbidden=Map.<String,Object>of("input_id",a.toString(),"restriction_type","FORBIDDEN","reason","测试禁用","source","测试依据","evidence",evidence(),"status","ACTIVE");String restrictionId=String.valueOf(service.saveRule(tenant,"restrictions",forbidden,"测试用户").get("id"));
            request.put("requestId",UUID.randomUUID().toString());assertEquals("BLOCKED",service.check(tenant,request,"测试用户").get("state"));db.update("UPDATE agri_prod_input_restriction SET status='INACTIVE' WHERE id=?",restrictionId);
            var stale=evidence();stale.put("verifiedOn",LocalDate.now().minusDays(8).toString());db.update("UPDATE agri_prod_input_restriction SET evidence_json=? WHERE id=?",encode(stale),catalogueId);
            request.put("requestId",UUID.randomUUID().toString());assertEquals("BLOCKED",service.check(tenant,request,"测试用户").get("state"));
            db.update("INSERT INTO agri_prod_input_usage(input_id,input_name,dosage,unit,method,used_at,tenant_id,status,deleted) VALUES(?,?,1,'克','喷雾',NOW(),?,1,0)",a,"测试农药A",tenant);String usage=String.valueOf(db.queryForObject("SELECT LAST_INSERT_ID()",Long.class));
            assertEquals(false,service.compareActual(tenant,recommendationId,Map.of("usageId",usage),"测试用户").get("matched"));
            service.compareActual(tenant,recommendationId,Map.of("usageId",usage),"测试用户");assertEquals(1,service.risks(tenant).size());
            var risk=service.risks(tenant).get(0);service.reviewRisk(tenant,String.valueOf(risk.get("id")),Map.of("note","测试核对处置，不改用药事实"),"复核用户");assertEquals("REVIEWED",service.risks(tenant).get(0).get("state"));
            assertThrows(BusinessException.class,()->service.compareActual("OTHER-TENANT",recommendationId,Map.of("usageId",usage),"测试用户"));
            assertFalse(((List<?>)service.detail(tenant,recommendationId).get("events")).isEmpty());
            assertTrue(db.queryForObject("SELECT COUNT(*) FROM agri_prod_input_safety_revision WHERE tenant_id=?",Integer.class,tenant)>=4);
            assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM agri_prod_input_stock_flow WHERE tenant_id=?",Integer.class,tenant));
        });
        assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM agri_prod_input_recommendation WHERE tenant_id=?",Integer.class,tenant));
        assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM agri_prod_input_usage WHERE tenant_id=?",Integer.class,tenant));
    }
    private String encode(Object value){try{return new ObjectMapper().writeValueAsString(value);}catch(Exception e){throw new RuntimeException(e);}}
}
