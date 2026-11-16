package com.agri.government.repository;

import com.agri.common.exception.BusinessException;
import com.agri.common.rbac.*;
import com.agri.government.controller.GovernmentInspectorController;
import com.agri.government.common.security.*;
import com.agri.government.integration.ProductionTraceClient;
import com.agri.government.security.GovernmentDataScope;
import com.agri.government.service.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.web.context.request.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.LocalDate;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 真实辖区授权表、真实控制器和拦截器；平台身份/能力外部服务使用可控替身。 */
class GovernmentMobileBoundaryTest {
    GovernmentMobileFlowTest f;
    GovernmentOpsRepository repo;
    GovernmentDataScope scope;
    GovernmentPersonnelService personnel;
    ObjectMapper json=new ObjectMapper();
    PermissionResolver permissions;
    CapabilityGuard capability;
    MockMvc mvc;
    static final String BASE="/api/v1/government/mobile";
    @BeforeEach void setup() throws Exception {
        f=new GovernmentMobileFlowTest();f.setup();
        f.jdbc.update("UPDATE gov_user SET platform_user_id=2002 WHERE id=2");
        f.jdbc.update("UPDATE gov_subject SET region_code='370781' WHERE id=1");
        f.jdbc.update("INSERT INTO gov_subject(id,subject_name,credit_code,region_code) VALUES(2,'辖区外主体','913700000000000002','110101')");
        f.jdbc.update("INSERT INTO gov_task(id,task_no,subject_id,subject_name,assignee_id,status) VALUES(2,'RW-OUT',2,'辖区外主体',2,'pending'),(3,'RW-OTHER',1,'测试主体',3,'pending')");
        var regions=List.of(new GovernmentScopeService.Region("370700","测试地区",true,List.of("inspection","case")));
        f.jdbc.update("INSERT INTO gov_scope_config(id,organization_code,organization_name,status,regions_json,version,updated_at) VALUES('s1','ORG-TEST','测试机构','enabled',?,1,'test')",json.writeValueAsString(regions));
        personnel=new GovernmentPersonnelService(f.jdbc,json,f.identity);
        personnel.save(null,new GovernmentPersonnelService.Grant(null,2L,"s1","enabled",regions,LocalDate.now().minusDays(1).toString(),LocalDate.now().plusDays(1).toString(),"测试授权依据",null));
        scope=new GovernmentDataScope(personnel,f.identity,f.jdbc);
        var target=new GovernmentOpsRepository(f.jdbc,f.identity,f.audit,mock(ProductionTraceClient.class),scope);
        var factory=new ProxyFactory(target);factory.setProxyTargetClass(true);
        factory.addAdvice(new TransactionInterceptor(new DataSourceTransactionManager(f.jdbc.getDataSource()),new AnnotationTransactionAttributeSource()));
        repo=(GovernmentOpsRepository)factory.getProxy();
        permissions=mock(PermissionResolver.class);when(permissions.currentPermissions()).thenReturn(Set.of("gov:inspector"));
        capability=mock(CapabilityGuard.class);
        var properties=new RbacProperties();properties.setRequireAuth(true);
        mvc=MockMvcBuilders.standaloneSetup(new GovernmentInspectorController(repo))
            .addInterceptors(new OperatorGuardInterceptor(permissions,properties),new GovernmentCapabilityInterceptor(capability)).build();
        mobileContext();
    }
    void mobileContext(){var request=new MockHttpServletRequest("GET",BASE+"/tasks");RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));}
    @AfterEach void cleanup(){RequestContextHolder.resetRequestAttributes();if(f!=null)f.cleanup();}
    @Test void actualScopeFiltersRegionAndOwner(){
        assertEquals(List.of(1L),repo.mobileTasks().stream().map(t->((Number)t.get("id")).longValue()).toList());
        assertThrows(BusinessException.class,()->repo.mobileTask(2));
        assertThrows(BusinessException.class,()->repo.startTask(2));
        assertThrows(BusinessException.class,()->repo.mobileTask(3));
        assertEquals(0,f.count("gov_task_check"));
    }
    @Test void dualRoleCannotBypassMobileScopeButOpsRemainsSeparate(){
        when(f.identity.isOps()).thenReturn(true);
        assertEquals(1,repo.mobileTasks().size());
        assertThrows(BusinessException.class,()->repo.startTask(2));
        var ops=new MockHttpServletRequest("GET","/api/v1/government/ops/tasks");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(ops));
        assertEquals("SELECT * FROM gov_task",scope.sql("SELECT * FROM gov_task"));
    }
    @Test void disabledOrganizationImmediatelyRevokesReadAndWrite(){
        f.jdbc.update("UPDATE gov_scope_config SET status='disabled'");
        assertTrue(repo.mobileTasks().isEmpty());assertThrows(BusinessException.class,()->repo.startTask(1));
        assertEquals(0,f.count("gov_task_check"));
    }
    @Test void expiredGrantImmediatelyRevokesAccess() throws Exception {
        var g=personnel.list().get(0);
        var expired=new GovernmentPersonnelService.Grant(g.id(),g.personnelId(),g.scopeId(),g.status(),g.regions(),LocalDate.now().minusDays(2).toString(),LocalDate.now().minusDays(1).toString(),g.basis(),g.version());
        f.jdbc.update("UPDATE gov_personnel_grant SET snapshot_json=?",json.writeValueAsString(expired));
        assertTrue(repo.mobileTasks().isEmpty());assertThrows(BusinessException.class,()->repo.startTask(1));
    }
    @Test void missingCaseDutyCannotCreateCaseOrNotification() throws Exception {
        var g=personnel.list().get(0);
        personnel.save(g.id(),new GovernmentPersonnelService.Grant(g.id(),2L,"s1","enabled",List.of(new GovernmentScopeService.Region("370700","测试地区",true,List.of("inspection"))),g.validFrom(),g.validUntil(),g.basis(),g.version()));
        assertEquals(1,repo.mobileTasks().size());
        assertThrows(BusinessException.class,()->repo.createCase(Map.of("taskId",1,"subjectId",1,"summary","现场事实")));
        assertEquals(0,f.count("gov_case"));assertEquals(0,f.count("gov_message"));
    }
    @Test void controllerRequiresLoginAndInspectorPermission() throws Exception {
        mvc.perform(get(BASE+"/tasks")).andExpect(status().isUnauthorized());
        when(permissions.currentPermissions()).thenReturn(Set.of("gov:admin"));
        mvc.perform(get(BASE+"/tasks").header("Authorization","Bearer boundary-test")).andExpect(status().isForbidden());
        when(permissions.currentPermissions()).thenReturn(null);
        mvc.perform(get(BASE+"/tasks").header("Authorization","Bearer boundary-test")).andExpect(status().isForbidden());
        assertEquals(0,f.count("gov_task_check"));
    }
    @Test void capabilityDenialAndOutagePreventWrites() throws Exception {
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN,"缺少政府人员身份")).when(capability).require(anyString(),anyString(),anyString());
        mvc.perform(post(BASE+"/tasks/1/start").header("Authorization","Bearer boundary-test")).andExpect(status().isForbidden());
        doThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"能力服务不可用")).when(capability).require(anyString(),anyString(),anyString());
        mvc.perform(post(BASE+"/tasks/1/start").header("Authorization","Bearer boundary-test")).andExpect(status().isServiceUnavailable());
        assertEquals(0,f.count("gov_task_check"));assertEquals("pending",f.status());
    }
    @Test void authorizedHttpFlowPersistsAndReadsBackAllRecords() throws Exception {
        mvc.perform(get(BASE+"/tasks").header("Authorization","Bearer boundary-test")).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        mvc.perform(get(BASE+"/tasks/1").header("Authorization","Bearer boundary-test")).andExpect(status().isOk());assertEquals(0,f.count("gov_task_check"));
        mvc.perform(post(BASE+"/tasks/1/start").header("Authorization","Bearer boundary-test")).andExpect(status().isOk()).andExpect(jsonPath("$.data.checklist.length()").value(2));
        mvc.perform(post(BASE+"/tasks/1/submit").header("Authorization","Bearer boundary-test").contentType("application/json").content(json.writeValueAsString(f.body(f.all())))).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("completed"));
        mvc.perform(post(BASE+"/cases").header("Authorization","Bearer boundary-test").contentType("application/json").content(json.writeValueAsString(Map.of("taskId",1,"subjectId",1,"summary","现场涉嫌违法事实","legalBasis","测试法律依据")))).andExpect(status().isOk());
        mvc.perform(post(BASE+"/evidence").header("Authorization","Bearer boundary-test").contentType("application/json").content(json.writeValueAsString(Map.of("taskNo","RW-TEST","description","原件编号 TEST-1","uploaded",true)))).andExpect(status().isOk());
        mvc.perform(get(BASE+"/evidence").header("Authorization","Bearer boundary-test")).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        assertEquals("completed",f.status());assertEquals(1,f.count("gov_case"));assertEquals(1,f.count("gov_evidence"));assertEquals(2,f.count("gov_message"));
        verify(capability,times(4)).require("Bearer boundary-test","gov.oversight","提交执法数据");
    }
}
