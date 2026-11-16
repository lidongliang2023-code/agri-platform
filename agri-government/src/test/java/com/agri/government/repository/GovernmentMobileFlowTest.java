package com.agri.government.repository;

import com.agri.common.exception.BusinessException;
import com.agri.government.integration.ProductionTraceClient;
import com.agri.government.security.GovernmentDataScope;
import com.agri.government.security.GovernmentIdentityService;
import com.agri.government.service.GovernmentAuditService;
import org.junit.jupiter.api.*;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 真实 JDBC + Spring 事务回归；身份与辖区作为已验证边界替身，不访问现有业务数据。 */
class GovernmentMobileFlowTest {
    JdbcTemplate jdbc;
    GovernmentOpsRepository repo;
    GovernmentIdentityService identity;
    GovernmentDataScope scope;
    GovernmentAuditService audit;
    String database;
    DriverManagerDataSource admin;

    @BeforeEach void setup() {
        DriverManagerDataSource ds;
        String mysql = System.getProperty("gov.test.mysql");
        if (mysql != null) {
            database="gov_mobile_test_"+UUID.randomUUID().toString().replace("-","");
            admin=new DriverManagerDataSource(mysql,System.getProperty("gov.test.user","root"),System.getProperty("gov.test.password","root"));
            new JdbcTemplate(admin).execute("CREATE DATABASE "+database+" CHARACTER SET utf8mb4");
            ds=new DriverManagerDataSource(mysql+database+"?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai",admin.getUsername(),admin.getPassword());
        } else ds=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","sa","");
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(ds);
        jdbc=new JdbcTemplate(ds);
        identity=mock(GovernmentIdentityService.class);
        scope=mock(GovernmentDataScope.class);
        when(scope.sql(anyString())).thenAnswer(i->i.getArgument(0));
        when(identity.currentInspector()).thenReturn(Map.of("id",2L,"name","测试执法员","organization","测试监管机构"));
        when(identity.operatorName()).thenReturn("测试执法员");
        when(identity.operatorRole()).thenReturn("执法人员");
        audit=spy(new GovernmentAuditService(jdbc));
        var target=new GovernmentOpsRepository(jdbc,identity,audit,mock(ProductionTraceClient.class),scope);
        var factory=new ProxyFactory(target);
        factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(ds),new AnnotationTransactionAttributeSource()));
        repo=(GovernmentOpsRepository)factory.getProxy();
        jdbc.update("INSERT INTO gov_subject(id,subject_name,credit_code) VALUES(1,'测试主体','913700000000000001')");
        jdbc.update("INSERT INTO gov_user(id,name,status) VALUES(2,'测试执法员','active')");
        jdbc.update("INSERT INTO gov_check_item(id,item_name,sort_order,status) VALUES(1,'证照核验',1,'active'),(2,'仓库核验',2,'active')");
        jdbc.update("INSERT INTO gov_task(id,task_no,subject_id,subject_name,assignee_id,status,checklist_total) VALUES(1,'RW-TEST',1,'测试主体',2,'pending',0)");
    }
    @AfterEach void cleanup(){if(database!=null&&database.matches("gov_mobile_test_[a-f0-9]{32}"))new JdbcTemplate(admin).execute("DROP DATABASE "+database);}
    int count(String table){return jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Integer.class);}
    Map<String,Object> answer(long id,boolean done){return Map.of("itemId",id,"done",done,"note","现场核验说明");}
    Map<String,Object> body(Object checks){return Map.of("checks",checks,"result","仓库存在问题，已记录待进一步处理");}
    List<Map<String,Object>> all(){return List.of(answer(1,true),answer(2,true));}
    String status(){return jdbc.queryForObject("SELECT status FROM gov_task WHERE id=1",String.class);}

    @Test void getIsReadOnlyAndStartIsIdempotent(){
        repo.mobileTask(1);repo.mobileTask(1);
        assertEquals(0,count("gov_task_check"));assertEquals("pending",status());
        repo.startTask(1);repo.startTask(1);
        assertEquals(2,count("gov_task_check"));assertEquals("in_progress",status());
        assertEquals(2,jdbc.queryForObject("SELECT checklist_total FROM gov_task WHERE id=1",Integer.class));
    }
    @Test void rejectsMissingDuplicateForeignAndMalformedItemsWithoutWrites(){
        repo.startTask(1);
        List<Object> invalid=List.of(List.of(answer(1,true)),List.of(answer(1,true),answer(1,true)),List.of(answer(1,true),answer(99,true)),List.of(answer(1,true),answer(2,false)),List.of(answer(1,true),"invalid"),List.of(answer(1,true),Map.of("itemId","x","done",true)),List.of(answer(1,true),Map.of("itemId",2,"done","true")),List.of(answer(1,true),Map.of("itemId",2,"done",true,"note","字".repeat(301))));
        for(Object input:invalid){assertThrows(BusinessException.class,()->repo.submitTask(1,body(input)));assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM gov_task_check WHERE done=TRUE",Integer.class));assertEquals("in_progress",status());assertEquals(0,count("gov_message"));}
        assertThrows(BusinessException.class,()->repo.submitTask(1,Map.of("checks",all())));
    }
    @Test void completeWritesChecksAuditAndOneNotificationAndRejectsReplay(){
        repo.startTask(1);repo.submitTask(1,body(all()));
        assertEquals("completed",status());assertEquals(2,jdbc.queryForObject("SELECT checklist_done FROM gov_task WHERE id=1",Integer.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM gov_task_check WHERE done=TRUE AND checked_at IS NOT NULL",Integer.class));
        assertEquals(1,count("gov_op_log"));assertEquals(1,count("gov_message"));
        assertFalse(jdbc.queryForObject("SELECT is_read FROM gov_message",Boolean.class));
        assertThrows(BusinessException.class,()->repo.submitTask(1,body(all())));assertEquals(1,count("gov_message"));
    }
    @Test void notificationFailureRollsBackEveryBusinessWrite(){
        repo.startTask(1);
        doThrow(new IllegalStateException("模拟通知表写入失败")).when(audit).notifySubject(anyLong(),anyString(),anyString(),anyString(),anyString(),anyString());
        assertThrows(IllegalStateException.class,()->repo.submitTask(1,body(all())));
        assertEquals("in_progress",status());assertEquals(0,count("gov_op_log"));assertEquals(0,count("gov_message"));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM gov_task_check WHERE done=TRUE",Integer.class));
    }
    @Test void foreignOwnerCannotReadStartOrSubmit(){
        when(identity.currentInspector()).thenReturn(Map.of("id",3L));
        assertThrows(BusinessException.class,()->repo.mobileTask(1));assertThrows(BusinessException.class,()->repo.startTask(1));assertThrows(BusinessException.class,()->repo.submitTask(1,body(all())));assertEquals(0,count("gov_task_check"));
    }
    @Test void scopeRejectionStopsWrites(){
        doThrow(BusinessException.forbidden("无辖区职责授权")).when(scope).requireRecord("gov_task",1L,"inspection");
        assertThrows(BusinessException.class,()->repo.startTask(1));assertEquals(0,count("gov_task_check"));
    }
    @Test void createTaskSnapshotsTemplateAndSendsUnreadMessage(){
        var task=repo.createTask(Map.of("subjectId",1,"assigneeId",2));
        assertEquals(2,task.get("checklistTotal"));assertEquals(2,count("gov_task_check"));
        assertFalse(jdbc.queryForObject("SELECT is_read FROM gov_message",Boolean.class));
    }
    @Test void taskCreationRollsBackOnAuditFailure(){
        doThrow(new IllegalStateException("模拟审计写入失败")).when(audit).log(anyString(),any(),anyString(),anyString(),anyString(),anyString(),any());
        assertThrows(IllegalStateException.class,()->repo.createTask(Map.of("subjectId",1,"assigneeId",2)));
        assertEquals(1,count("gov_task"));assertEquals(0,count("gov_task_check"));assertEquals(0,count("gov_message"));
    }
    @Test void linkedCaseAndEvidencePersistActualOwnerAndSubject(){
        var c=repo.createCase(Map.of("taskId",1,"subjectId",1,"summary","现场发现涉嫌违法事实","legalBasis","测试条款"));
        assertNotNull(c.get("id"));assertEquals(1,count("gov_case"));
        var e=repo.addEvidence(Map.of("taskNo","RW-TEST","description","原始材料保管编号 A-1","evidenceType","现场取证说明","uploaded",true));
        assertEquals(2L,((Number)e.get("capturedById")).longValue());assertTrue(String.valueOf(e.get("evidenceHash")).matches("[a-f0-9]{64}"));
        assertEquals(1,count("gov_evidence"));assertEquals(1L,jdbc.queryForObject("SELECT subject_id FROM gov_evidence",Long.class));
        assertThrows(BusinessException.class,()->repo.addEvidence(Map.of("description","无关联任务")));
        assertThrows(BusinessException.class,()->repo.createCase(Map.of("subjectId",1,"summary","无关联任务")));
    }
    @Test void evidenceAndCaseRollbackIfAuditFails(){
        doThrow(new IllegalStateException("模拟审计写入失败")).when(audit).log(anyString(),any(),anyString(),anyString(),anyString(),anyString(),any());
        assertThrows(IllegalStateException.class,()->repo.addEvidence(Map.of("taskNo","RW-TEST","description","现场说明")));
        assertThrows(IllegalStateException.class,()->repo.createCase(Map.of("taskId",1,"subjectId",1,"summary","现场发现")));
        assertEquals(0,count("gov_evidence"));assertEquals(0,count("gov_case"));assertEquals(0,count("gov_message"));
    }
}
