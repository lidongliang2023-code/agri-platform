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
        jdbc.execute("CREATE TABLE iot_alert(id BIGINT PRIMARY KEY,status VARCHAR(30),handle_note VARCHAR(800),handled_by VARCHAR(120),handled_at VARCHAR(40))");
        jdbc.update("INSERT INTO iot_alert(id,status) VALUES(1,'pending')");
        jdbc.execute("CREATE TABLE iot_tenant(id BIGINT PRIMARY KEY,tenant_name VARCHAR(100))");
        jdbc.execute("CREATE TABLE iot_work_order(id BIGINT PRIMARY KEY,tenant_id BIGINT,order_no VARCHAR(64),source_name VARCHAR(80),device_name VARCHAR(80),order_type VARCHAR(80),priority VARCHAR(30),status VARCHAR(30),technician VARCHAR(120),description VARCHAR(500),created_at VARCHAR(40),completed_at VARCHAR(40))");
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
    @Test void singleMessageReadPersistsAndChecksOwnership() {
        IotAppRepository app=new IotAppRepository(jdbc,null,null,identity,null,new ObjectMapper());
        app.readMessage(1);
        assertTrue(jdbc.queryForObject("SELECT is_read FROM iot_message WHERE id=1",Boolean.class));
        verify(identity).requireTenantRow("iot_message",1L,"消息");
        doThrow(new IllegalArgumentException("跨主体拒绝")).when(identity).requireTenantRow("iot_message",2L,"消息");
        assertThrows(IllegalArgumentException.class,()->app.readMessage(2));
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
