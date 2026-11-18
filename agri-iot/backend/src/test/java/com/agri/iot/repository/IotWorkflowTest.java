package com.agri.iot.repository;

import com.agri.iot.integration.IotIdentityService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.Map;
import java.util.List;
import com.agri.iot.integration.ProductionPlotClient;
import com.agri.iot.integration.ProductionFarmClient;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class IotWorkflowTest {
    JdbcTemplate jdbc;
    IotIdentityService identity;
    IotOpsRepository ops;
    @BeforeEach void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+java.util.UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", ""));
        identity=mock(IotIdentityService.class);
        when(identity.requireOperatorName()).thenReturn("测试操作人");
        when(identity.currentTenantId()).thenReturn(2001L);
        when(identity.tenantIdOrNull()).thenReturn(2001L);
        jdbc.execute("CREATE TABLE iot_alert(id BIGINT PRIMARY KEY,status VARCHAR(30),handle_note VARCHAR(800),handled_by VARCHAR(120),handled_at VARCHAR(40))");
        jdbc.update("INSERT INTO iot_alert(id,status) VALUES(1,'pending')");
        jdbc.execute("CREATE TABLE iot_tenant(id BIGINT PRIMARY KEY,tenant_name VARCHAR(100))");
        jdbc.execute("CREATE TABLE iot_work_order(id BIGINT AUTO_INCREMENT PRIMARY KEY,tenant_id BIGINT,order_no VARCHAR(64),source_name VARCHAR(80),device_name VARCHAR(80),order_type VARCHAR(80),priority VARCHAR(30),status VARCHAR(30),technician VARCHAR(120),description VARCHAR(500),created_at VARCHAR(40),completed_at VARCHAR(40))");
        jdbc.update("INSERT INTO iot_work_order(id,tenant_id,order_no,status,description) VALUES(1,2001,'WO-TEST','pending','实际报修描述')");
        jdbc.execute("CREATE TABLE iot_ops_log(id BIGINT AUTO_INCREMENT PRIMARY KEY,operator_name VARCHAR(120),action_name VARCHAR(80),target_name VARCHAR(100),detail_text VARCHAR(1000),ip_address VARCHAR(80),created_at VARCHAR(40))");
        jdbc.execute("CREATE TABLE iot_message(id BIGINT PRIMARY KEY,tenant_id BIGINT,message_type VARCHAR(40),title VARCHAR(200),content VARCHAR(1000),is_read BOOLEAN,created_at VARCHAR(40))");
        jdbc.update("INSERT INTO iot_message VALUES(1,2001,'device','设备消息','内容',FALSE,'2026-11-06 10:00')");
        ops=new IotOpsRepository(jdbc,identity);
    }
    @Test void alertMustProgressAndPreserveHistory() {
        assertThrows(IllegalArgumentException.class,()->IotAppRepository.transitionAlert(jdbc,1,Map.of("status","resolved","note","实际处理结果"),"甲"));
        IotAppRepository.transitionAlert(jdbc,1,Map.of("status","handling","note","现场正在核验"),"甲");
        IotAppRepository.transitionAlert(jdbc,1,Map.of("status","resolved","note","故障实际修复"),"乙");
        String history=jdbc.queryForObject("SELECT handle_note FROM iot_alert WHERE id=1",String.class);
        assertTrue(history.contains("现场正在核验"));assertTrue(history.contains("故障实际修复"));assertTrue(history.contains("乙"));
        assertThrows(IllegalArgumentException.class,()->IotAppRepository.transitionAlert(jdbc,1,Map.of("status","handling","note","不允许状态回退"),"甲"));
    }
    @Test void alertRejectsInvalidNotesAndOverflow() {
        assertThrows(IllegalArgumentException.class,()->IotAppRepository.transitionAlert(jdbc,1,Map.of("status","handling","note",""),"甲"));
        jdbc.update("UPDATE iot_alert SET handle_note=? WHERE id=1","旧".repeat(790));
        assertThrows(IllegalArgumentException.class,()->IotAppRepository.transitionAlert(jdbc,1,Map.of("status","handling","note","现场正在核验"),"甲"));
        assertEquals("pending",jdbc.queryForObject("SELECT status FROM iot_alert WHERE id=1",String.class));
    }
    @Test void workOrderPersistsBothStagesAndAudit() {
        assertThrows(IllegalArgumentException.class,()->ops.handleWorkOrder(1,Map.of("status","completed","note","现场实际修复")));
        ops.handleWorkOrder(1,Map.of("status","processing","note","已受理正在检查"));
        ops.handleWorkOrder(1,Map.of("status","completed","note","已更换损坏部件"));
        assertEquals("completed",jdbc.queryForObject("SELECT status FROM iot_work_order WHERE id=1",String.class));
        assertNotNull(jdbc.queryForObject("SELECT completed_at FROM iot_work_order WHERE id=1",String.class));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
        assertTrue(String.valueOf(ops.workOrders().get(0).get("description")).contains("实际报修描述"));
        assertThrows(IllegalArgumentException.class,()->ops.handleWorkOrder(1,Map.of("status","processing","note","不允许重复处置")));
    }
    @Test void assignedWorkOrderMustBeAcceptedBeforeCompletion() {
        jdbc.update("UPDATE iot_work_order SET status='assigned' WHERE id=1");
        assertThrows(IllegalArgumentException.class,()->ops.handleWorkOrder(1,Map.of("status","completed","note","不能跳过受理")));
        assertEquals("processing",ops.handleWorkOrder(1,Map.of("status","processing","note","已接单现场检查")).get("status"));
        assertThrows(IllegalArgumentException.class,()->ops.handleWorkOrder(1,Map.of("status","processing","note","不能重复受理")));
        assertEquals("completed",ops.handleWorkOrder(1,Map.of("status","completed","note","已完成故障修复")).get("status"));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void createdWorkOrderStartsPendingWithRequestedPriority() {
        IotAppRepository app = bindingRepository();
        Map<String,Object> created = app.createWorkOrder(Map.of("deviceId",99,"priority","critical","description","现场设备无法启动"));
        assertEquals("pending", created.get("status"));
        assertEquals("critical", created.get("priority"));
        long id = ((Number)created.get("id")).longValue();
        ops.handleWorkOrder(id,Map.of("status","processing","note","已受理正在检查"));
        assertEquals("processing", jdbc.queryForObject("SELECT status FROM iot_work_order WHERE id=?",String.class,id));
        verify(identity).requireDeviceAccess(99L);
    }
    @Test void fullLengthWorkOrderPreservesDescriptionAndBothHandlingNotes() {
        String original = "报".repeat(500);
        jdbc.update("UPDATE iot_work_order SET description=? WHERE id=1", original);
        ops.handleWorkOrder(1,Map.of("status","processing","note","查".repeat(200)));
        ops.handleWorkOrder(1,Map.of("status","completed","note","修".repeat(200)));
        assertEquals(original,jdbc.queryForObject("SELECT description FROM iot_work_order WHERE id=1",String.class));
        String displayed = String.valueOf(ops.workOrders().get(0).get("description"));
        assertTrue(displayed.startsWith(original));
        assertTrue(displayed.contains("查".repeat(200)));
        assertTrue(displayed.contains("修".repeat(200)));
        assertTrue(displayed.contains("测试操作人"));
        assertEquals(2,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
        IotAppRepository app = new IotAppRepository(jdbc,null,null,identity,null,new ObjectMapper());
        assertEquals(displayed,app.workOrders().get(0).get("description"));
    }
    @Test void singleMessageReadPersistsAndChecksOwnership() {
        IotAppRepository app=new IotAppRepository(jdbc,null,null,identity,null,new ObjectMapper());
        app.readMessage(1);
        assertTrue(jdbc.queryForObject("SELECT is_read FROM iot_message WHERE id=1",Boolean.class));
        verify(identity).requireTenantRow("iot_message",1L,"消息");
        doThrow(new IllegalArgumentException("跨主体拒绝")).when(identity).requireTenantRow("iot_message",2L,"消息");
        assertThrows(IllegalArgumentException.class,()->app.readMessage(2));
    }

    private void accessFixture() {
        jdbc.execute("CREATE TABLE iot_access_audit(id BIGINT PRIMARY KEY,device_code VARCHAR(60),device_name VARCHAR(160),tenant_name VARCHAR(160),request_type VARCHAR(80),status VARCHAR(30),submitted_at VARCHAR(40),auditor VARCHAR(80),note VARCHAR(800))");
        jdbc.update("INSERT INTO iot_access_audit(id,device_code,status) VALUES(1,'ACCESS-TEST','pending')");
    }
    @Test void accessReviewIsFinalAndAuditorComesFromIdentity() {
        accessFixture();
        var result=ops.reviewAccess(1,Map.of("status","approved","note","  核验认证资料通过  ","auditor","伪造审核人"));
        assertEquals("approved",result.get("status"));
        assertEquals("测试操作人",result.get("auditor"));
        assertEquals("核验认证资料通过",result.get("note"));
        for(String status:List.of("approved","rejected")) {
            assertThrows(IllegalArgumentException.class,()->ops.reviewAccess(1,Map.of("status",status,"note","不得覆盖原来意见")));
        }
        assertEquals("核验认证资料通过",jdbc.queryForObject("SELECT note FROM iot_access_audit WHERE id=1",String.class));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void rejectedAccessCannotBeReopened() {
        accessFixture();
        assertEquals("rejected",ops.reviewAccess(1,Map.of("status","rejected","note","认证资料不符合要求")).get("status"));
        assertThrows(IllegalArgumentException.class,()->ops.reviewAccess(1,Map.of("status","approved","note","不得更改驳回结论")));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void accessReviewRequiresExplicitDecisionAndBoundedNote() {
        accessFixture();
        for(String status:List.of("", "pending", "invalid")) {
            assertThrows(IllegalArgumentException.class,()->ops.reviewAccess(1,Map.of("status",status,"note","核验认证资料通过")));
        }
        assertThrows(IllegalArgumentException.class,()->ops.reviewAccess(1,Map.of("note","缺少结论不能通过")));
        for(String note:List.of("", "   ", "好", "三个字", "长".repeat(201))) {
            assertThrows(IllegalArgumentException.class,()->ops.reviewAccess(1,Map.of("status","approved","note",note)));
        }
        assertEquals("pending",jdbc.queryForObject("SELECT status FROM iot_access_audit WHERE id=1",String.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
        assertEquals("approved",ops.reviewAccess(1,Map.of("status","approved","note","验证通过")).get("status"));
    }
    @Test void accessReviewAcceptsTwoHundredCharactersAndMissingIdDoesNotAudit() {
        accessFixture();
        assertThrows(RuntimeException.class,()->ops.reviewAccess(999,Map.of("status","approved","note","不存在的审核申请")));
        String note="核".repeat(200);
        assertEquals(note,ops.reviewAccess(1,Map.of("status","rejected","note",note)).get("note"));
        assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void accessReviewRollsBackWhenAuditFails() {
        accessFixture();
        var factory=new org.springframework.aop.framework.ProxyFactory(ops);
        factory.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(
                new org.springframework.jdbc.datasource.DataSourceTransactionManager(jdbc.getDataSource()),
                new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        IotOpsRepository transactional=(IotOpsRepository)factory.getProxy();
        jdbc.execute("ALTER TABLE iot_ops_log ADD CONSTRAINT reject_access_log CHECK(action_name <> '设备接入审核')");
        assertThrows(RuntimeException.class,()->transactional.reviewAccess(1,Map.of("status","approved","note","日志失败需要回滚")));
        assertEquals("pending",jdbc.queryForObject("SELECT status FROM iot_access_audit WHERE id=1",String.class));
        assertNull(jdbc.queryForObject("SELECT auditor FROM iot_access_audit WHERE id=1",String.class));
    }

    private IotAppRepository bindingRepository() {
        jdbc.execute("""
CREATE TABLE IF NOT EXISTS iot_device (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    farm_id BIGINT NOT NULL,
    plot_id BIGINT,
    gateway_id BIGINT,
    group_id BIGINT,
    device_code VARCHAR(60) NOT NULL UNIQUE,
    device_name VARCHAR(160) NOT NULL,
    type_id BIGINT,
    type_name VARCHAR(120),
    protocol_name VARCHAR(40),
    online_status VARCHAR(30) DEFAULT 'online',
    status_text VARCHAR(30) DEFAULT 'normal',
    last_report VARCHAR(40),
    signal_strength INT DEFAULT -60,
    battery_rate INT DEFAULT 100,
    firmware_version VARCHAR(40),
    latitude DECIMAL(10,6),
    longitude DECIMAL(10,6),
    control_capable BOOLEAN DEFAULT FALSE,
    config_text VARCHAR(1000),
    created_at VARCHAR(40)
);
                """);
        jdbc.update("INSERT INTO iot_device(id,tenant_id,farm_id,plot_id,device_code,device_name) VALUES(99,2001,1,10,'BIND-TEST','绑定测试设备')");
        ProductionPlotClient plots = mock(ProductionPlotClient.class);
        when(plots.listCurrentTenantPlots()).thenReturn(List.of(
                Map.of("id", 10L, "farmId", 1L, "productionStatus", 1),
                Map.of("id", 11L, "farmId", 1L, "productionStatus", 2),
                Map.of("id", 12L, "farmId", 2L, "productionStatus", 1),
                Map.of("id", 13L, "farmId", 1L, "productionStatus", 0)));
        return new IotAppRepository(jdbc, plots, mock(ProductionFarmClient.class), identity, null, new ObjectMapper());
    }
    private IotAppRepository groupRepository() {
        IotAppRepository app = bindingRepository();
        jdbc.execute("CREATE TABLE iot_device_group(id BIGINT PRIMARY KEY,tenant_id BIGINT,group_name VARCHAR(80),icon_text VARCHAR(20),color_value VARCHAR(20),device_count INT,is_default BOOLEAN)");
        jdbc.update("INSERT INTO iot_device_group VALUES(1,2001,'默认组','','',1,TRUE),(2,2001,'目标组','','',0,FALSE),(3,2003,'其他主体','','',0,FALSE)");
        jdbc.update("UPDATE iot_device SET group_id=1 WHERE id=99");
        doAnswer(invocation -> {
            long group = invocation.getArgument(1);
            if (group != 1 && group != 2) throw new IllegalArgumentException("分组不存在或不属于当前主体");
            return Map.of("id",group,"tenant_id",2001L);
        }).when(identity).requireTenantRow(eq("iot_device_group"),anyLong(),eq("设备分组"));
        when(identity.currentFarmIds()).thenReturn(List.of(1L));
        when(identity.farmPlaceholders(anyList())).thenReturn("?");
        return app;
    }
    private void assertGroupCounts(int first, int second) {
        assertEquals(first,jdbc.queryForObject("SELECT device_count FROM iot_device_group WHERE id=1",Integer.class));
        assertEquals(second,jdbc.queryForObject("SELECT device_count FROM iot_device_group WHERE id=2",Integer.class));
    }
    @Test void groupMoveRepeatAndReturnKeepCountsConsistent() {
        IotAppRepository app=groupRepository();
        assertEquals(2L,((Number)app.updateDevice(99,Map.of("groupId",2)).get("groupId")).longValue());
        assertGroupCounts(0,1);
        assertEquals(1,app.devices(null,null,2L,null).size());
        assertTrue(app.devices(null,null,1L,null).isEmpty());
        app.updateDevice(99,Map.of("groupId",2));assertGroupCounts(0,1);
        app.updateDevice(99,Map.of("groupId","1"));assertGroupCounts(1,0);
    }
    @Test void invalidGroupValuesNeverClearOrTruncateBinding() {
        IotAppRepository app=groupRepository();
        for(Object value:List.of("abc","", " ", true, 1.5, 2.9, "1.2", 0, -1, "9223372036854775808")) {
            assertThrows(IllegalArgumentException.class,()->app.updateDevice(99,Map.of("groupId",value)),String.valueOf(value));
            assertEquals(1L,jdbc.queryForObject("SELECT group_id FROM iot_device WHERE id=99",Long.class));assertGroupCounts(1,0);
        }
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void explicitGroupUnbindAndRebindKeepCountsConsistent() {
        IotAppRepository app=groupRepository();var body=new java.util.HashMap<String,Object>();body.put("groupId",null);
        assertNull(app.updateDevice(99,body).get("groupId"));assertGroupCounts(0,0);
        app.updateDevice(99,body);assertGroupCounts(0,0);
        app.updateDevice(99,Map.of("groupId",2));assertGroupCounts(0,1);
    }
    @Test void omittedGroupPreservesBindingAndCounts() {
        IotAppRepository app=groupRepository();app.updateDevice(99,Map.of("deviceName","改名设备"));
        assertEquals(1L,jdbc.queryForObject("SELECT group_id FROM iot_device WHERE id=99",Long.class));assertGroupCounts(1,0);
    }
    @Test void foreignAndMissingGroupRejectWholeEdit() {
        IotAppRepository app=groupRepository();
        for(long group:List.of(3L,999L))assertThrows(IllegalArgumentException.class,()->app.updateDevice(99,Map.of("groupId",group,"deviceName","不应写入")));
        assertEquals("绑定测试设备",jdbc.queryForObject("SELECT device_name FROM iot_device WHERE id=99",String.class));assertGroupCounts(1,0);
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void groupDirectoryAndDeviceFiltersAreScoped() {
        IotAppRepository app=groupRepository();assertEquals(2,app.groups().size());
        assertTrue(app.groups().stream().noneMatch(g->((Number)g.get("id")).longValue()==3));
        assertTrue(app.devices(null,null,3L,null).isEmpty());
        when(identity.tenantIdOrNull()).thenReturn(2003L);assertEquals(1,app.groups().size());
        when(identity.tenantIdOrNull()).thenReturn(null);assertTrue(app.groups().isEmpty());
    }
    @Test void unauthorizedDeviceCannotChangeGroup() {
        IotAppRepository app=groupRepository();doThrow(new IllegalArgumentException("无设备权限")).when(identity).requireDeviceAccess(99L);
        assertThrows(IllegalArgumentException.class,()->app.updateDevice(99,Map.of("groupId",2)));assertGroupCounts(1,0);
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void groupMoveRollsBackWithFailedAudit() {
        IotAppRepository app=groupRepository();var factory=new org.springframework.aop.framework.ProxyFactory(app);
        factory.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(new org.springframework.jdbc.datasource.DataSourceTransactionManager(jdbc.getDataSource()),new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));
        IotAppRepository transactional=(IotAppRepository)factory.getProxy();
        jdbc.execute("ALTER TABLE iot_ops_log ADD CONSTRAINT reject_group_log CHECK(action_name <> '更新设备')");
        assertThrows(RuntimeException.class,()->transactional.updateDevice(99,Map.of("groupId",2)));
        assertEquals(1L,jdbc.queryForObject("SELECT group_id FROM iot_device WHERE id=99",Long.class));assertGroupCounts(1,0);
    }
    @Test void deviceRebindPersistsAndAuditsWithoutChangingIdentity() {
        IotAppRepository app = bindingRepository();
        Map<String,Object> result = app.updateDevice(99, Map.of("plotId", 11));
        assertEquals(11L, ((Number)result.get("plotId")).longValue());
        assertEquals(1L, ((Number)result.get("farmId")).longValue());
        assertEquals("BIND-TEST", result.get("deviceCode"));
        String audit=jdbc.queryForObject("SELECT detail_text FROM iot_ops_log",String.class);
        assertTrue(audit.contains("10 → 11"));
        verify(identity).requireDeviceAccess(99L);
    }
    @Test void deviceExplicitUnbindPersistsNull() {
        IotAppRepository app = bindingRepository();
        Map<String,Object> body = new java.util.HashMap<>(); body.put("plotId",null);
        assertNull(app.updateDevice(99,body).get("plotId"));
        assertNull(jdbc.queryForObject("SELECT plot_id FROM iot_device WHERE id=99",Long.class));
    }
    @Test void omittedPlotDoesNotUnbind() {
        IotAppRepository app = bindingRepository();
        assertEquals(10L,((Number)app.updateDevice(99,Map.of()).get("plotId")).longValue());
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void invalidPlotValuesNeverClearBinding() {
        IotAppRepository app = bindingRepository();
        for (Object invalid: List.of("abc", "", 0, -1, 10.5, "9223372036854775808")) {
            assertThrows(IllegalArgumentException.class,()->app.updateDevice(99,Map.of("plotId",invalid)));
            assertEquals(10L,jdbc.queryForObject("SELECT plot_id FROM iot_device WHERE id=99",Long.class));
        }
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void foreignFarmMissingAndInactivePlotsNeverPersist() {
        IotAppRepository app = bindingRepository();
        for(long plotId: List.of(12L,13L,999L)) {
            assertThrows(IllegalArgumentException.class,()->app.updateDevice(99,Map.of("plotId",plotId)));
            assertEquals(10L,jdbc.queryForObject("SELECT plot_id FROM iot_device WHERE id=99",Long.class));
        }
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
    @Test void unauthorizedDeviceCannotRebind() {
        IotAppRepository app = bindingRepository();
        doThrow(new IllegalArgumentException("设备不属于当前主体")).when(identity).requireDeviceAccess(99L);
        assertThrows(IllegalArgumentException.class,()->app.updateDevice(99,Map.of("plotId",11)));
        assertEquals(10L,jdbc.queryForObject("SELECT plot_id FROM iot_device WHERE id=99",Long.class));
        assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));
    }
}
