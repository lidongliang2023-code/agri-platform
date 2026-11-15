package com.agri.production.service;

import com.agri.production.integration.ProcessingOrderClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.ClassPathResource;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** opt-in，真实MySQL，所有业务测试写入同一回滚事务；订单接口使用测试替身。 */
class ProcessingScheduleDatabaseTest {
    @Test void mysqlLifecycleAndBoundaries(){
        Assumptions.assumeTrue("true".equals(System.getenv("AGRI_SCHEDULE_DB_TEST")));
        var ds=new DriverManagerDataSource("jdbc:mysql://localhost:3306/agri_production?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai",System.getenv().getOrDefault("AGRI_DB_USER","root"),System.getenv().getOrDefault("AGRI_DB_PASSWORD","root"));
        new ResourceDatabasePopulator(new ClassPathResource("schema-patch-processing-schedule.sql")).execute(ds);
        var db=new JdbcTemplate(ds);var orderClient=mock(ProcessingOrderClient.class);var mapper=new ObjectMapper().findAndRegisterModules().disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        var service=new ProcessingScheduleService(db,mapper,orderClient);String t="SCHEDULE-TEST-"+UUID.randomUUID();
        new TransactionTemplate(new DataSourceTransactionManager(ds)).executeWithoutResult(tx->{tx.setRollbackOnly();
            var start=LocalDateTime.now().minusSeconds(20).withNano(0);var due=start.plusDays(2);
            db.update("INSERT INTO agri_prod_harvest_batch(batch_no,quantity,unit,tenant_id,status,deleted) VALUES(?,10000,'kg',?,1,0)",t,t);
            Long batch=db.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
            Map<String,Object> order=new LinkedHashMap<>(Map.of("id","1","orderNo","TEST-SO","status","paid","deliveryDeadline",due.toString(),"items",List.of(Map.of("id","2","category","绿茶","grade","一级","quantity",1000,"unit","kg"))));
            when(orderClient.detail(eq(t),eq("1"))).thenReturn(order);
            var resource=Map.<String,Object>of("id","DRY-TEST","name","测试烘干机","operation","DRYING","kgPerHour",100,"availability",0.88,"availableFrom",start.toString(),"sourceEvidence","测试核验","downtime",List.of());
            var provider=Map.<String,Object>of("id","OUT-TEST","name","测试外协","qualification","测试证据","traceEvidence","测试追溯","traceable",true,"validUntil",LocalDate.now().plusDays(30).toString(),"categories",List.of("绿茶"),"pricePerKg",1.2,"capacityKg",1000);
            var cfg=new LinkedHashMap<String,Object>(Map.of("sourceVersion","TEST-V1","categoryMinutes",90,"gradeMinutes",30,"maxChanges",4,"resources",List.of(resource),"providers",List.of(provider)));
            assertEquals(1,service.saveConfig(t,cfg,"owner").get("version"));
            var job=new LinkedHashMap<String,Object>(Map.of("key","J1","orderId","1","itemId","2","batchId",batch,"kg",88,"arrival",start.toString(),"route",List.of("DRYING"),"priority",1));
            var request=new LinkedHashMap<String,Object>(Map.of("start",start.toString(),"jobs",List.of(job)));
            var draft=service.solve(t,request,"planner");String id=draft.get("id").toString();assertEquals("DRAFT",draft.get("status"));
            assertThrows(RuntimeException.class,()->service.detail("OTHER",id));assertThrows(RuntimeException.class,()->service.publish(t,id,"planner"));
            service.approve(t,id,"核验通过","owner");var published=service.publish(t,id,"planner");assertEquals("PUBLISHED",published.get("status"));
            service.publish(t,id,"planner");assertEquals(1,db.queryForObject("SELECT COUNT(*) FROM agri_prod_schedule_work WHERE plan_id=?",Integer.class,id));
            assertThrows(RuntimeException.class,()->service.saveConfig(t,cfg,"owner"));
            assertThrows(RuntimeException.class,()->service.close(t,id,"owner"));
            var works=(List<Map<String,Object>>)published.get("works");String wid=works.get(0).get("id").toString();
            assertThrows(RuntimeException.class,()->service.work(t,id,wid,Map.of("action","START"),"operator"));
            service.work(t,id,wid,Map.of("action","START","arrivalConfirmed",true,"arrivalEvidence","入厂单TEST"),"operator");
            assertThrows(RuntimeException.class,()->service.cancel(t,id,"取消","owner"));
            db.update("INSERT INTO agri_prod_process_record(process_code,batch_id,batch_no,process_type,input_quantity,input_unit,status,started_at,finished_at,tenant_id,deleted) VALUES(?,?,?,'DRYING',88,'kg','DONE',?,?,?,0)",t,batch,t,start.minusHours(1),start,t);
            Long record=db.queryForObject("SELECT LAST_INSERT_ID()",Long.class);
            service.work(t,id,wid,Map.of("action","COMPLETE","processRecordId",record),"operator");assertThrows(RuntimeException.class,()->service.work(t,id,wid,Map.of("action","COMPLETE","processRecordId",record),"operator"));
            assertEquals("COMPLETED",service.close(t,id,"owner").get("status"));
            assertTrue(db.queryForObject("SELECT COUNT(*) FROM agri_prod_schedule_event WHERE plan_id=?",Integer.class,id)>=5);
            // 剩余数量、跨计划占用与重排审批。
            job.put("key","J2");job.put("kg",950);assertThrows(RuntimeException.class,()->service.solve(t,request,"planner"));job.put("kg",88);
            var second=service.solve(t,request,"planner");String secondId=second.get("id").toString();service.approve(t,secondId,"同意","owner");service.publish(t,secondId,"planner");
            var replan=new LinkedHashMap<>(request);replan.put("parentId",secondId);replan.put("reason","插单测试");var replacement=service.solve(t,replan,"planner");assertEquals(true,replacement.get("approvalRequired"));String rid=replacement.get("id").toString();service.approve(t,rid,"锁定窗口变更同意","owner");service.publish(t,rid,"planner");assertEquals("SUPERSEDED",service.detail(t,secondId).get("status"));
            assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM agri_prod_schedule_work a JOIN agri_prod_schedule_work b ON a.id<b.id AND a.tenant_id=b.tenant_id AND a.resource_id=b.resource_id AND a.setup_start<b.ends_at AND a.ends_at>b.setup_start WHERE a.tenant_id=? AND a.status IN ('READY','RUNNING','DONE') AND b.status IN ('READY','RUNNING','DONE')",Integer.class,t));
            service.cancel(t,rid,"测试撤销","owner");
            // 制造已核验真实订单的紧迫交期，外协成本与收货形成闭环。
            order.put("deliveryDeadline",start.plusMinutes(1).toString());job.put("key","J3");var third=service.solve(t,request,"planner");String tid=third.get("id").toString();
            assertThrows(RuntimeException.class,()->service.decide(t,tid,Map.of("jobKey","J3","type","OUTSOURCE","providerId","MISSING","reason","测试"),"planner"));
            service.decide(t,tid,Map.of("jobKey","J3","type","OUTSOURCE","providerId","OUT-TEST","reason","瓶颈外协"),"planner");service.approve(t,tid,"资质通过","owner");var out=service.publish(t,tid,"planner");assertTrue(((List<?>)out.get("works")).isEmpty());
            var external=(List<Map<String,Object>>)out.get("outsource");assertEquals(1,external.size());assertEquals(105.60,((Number)external.get(0).get("cost")).doubleValue(),0.001);
            assertThrows(RuntimeException.class,()->service.close(t,tid,"owner"));service.receipt(t,tid,external.get(0).get("id").toString(),Map.of("traceCode","TEST-TRACE","acceptanceEvidence","TEST-QC"),"qc");assertEquals("COMPLETED",service.close(t,tid,"owner").get("status"));
            assertThrows(RuntimeException.class,()->service.solve(t,new LinkedHashMap<>(Map.of("start",start,"jobs",List.of(new LinkedHashMap<>(Map.of("key","UNAUTH","orderId","1","itemId","2","batchId",batch+999999,"kg",1,"arrival",start,"route",List.of("DRYING")))))),"planner"));
        });
        assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM agri_prod_schedule_plan WHERE tenant_id=?",Integer.class,t));
        assertEquals(0,db.queryForObject("SELECT COUNT(*) FROM agri_prod_harvest_batch WHERE tenant_id=?",Integer.class,t));
    }
}
