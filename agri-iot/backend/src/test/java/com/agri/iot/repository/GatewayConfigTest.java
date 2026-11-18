package com.agri.iot.repository;

import com.agri.iot.integration.IotIdentityService;
import com.agri.iot.integration.ProductionFarmClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GatewayConfigTest {
    JdbcTemplate jdbc;
    IotIdentityService identity;
    ProductionFarmClient farms;
    IotAppRepository app;
    @BeforeEach void setup() {
        var ds=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa","");
        new ResourceDatabasePopulator(new ClassPathResource("schema-iot-app.sql")).execute(ds);
        jdbc=new JdbcTemplate(ds);
        identity=mock(IotIdentityService.class);farms=mock(ProductionFarmClient.class);
        when(identity.currentFarmIds()).thenReturn(List.of(1L,2L));
        when(identity.farmPlaceholders(anyList())).thenReturn("?,?");
        when(identity.currentFarms()).thenReturn(List.of(Map.of("id",1L,"farmName","测试农场一","tenantId",2001L),Map.of("id",2L,"farmName","测试农场二","tenantId",2001L)));
        when(identity.requireOperatorName()).thenReturn("网关测试操作人");
        when(identity.clientIp()).thenReturn("127.0.0.1");
        when(farms.requireCurrentTenantFarm(anyLong())).thenAnswer(i->{long id=i.getArgument(0);if(id!=1&&id!=2)throw new IllegalArgumentException("跨主体农场拒绝");return Map.of("id",id,"tenantId",2001L);});
        app=new IotAppRepository(jdbc,null,farms,identity,null,new ObjectMapper());
    }
    Map<String,Object> body(){var b=new HashMap<String,Object>();b.put("gatewayCode","GW-TEST");b.put("gatewayName","网关配置测试");b.put("farmId",1);b.put("protocol","MQTT");b.put("ipAddress","192.0.2.10");return b;}
    long create(){return ((Number)app.createGateway(body()).get("id")).longValue();}
    int logs(){return jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class);}
    @Test void createUpdateReadDeleteAndAudit(){long id=create();var row=app.gateway(id);assertEquals("offline",row.get("onlineStatus"));assertEquals(0,row.get("totalCount"));var b=body();b.put("gatewayName","更新网关名称");b.put("farmId",2);b.put("model","TEST-2");b.put("firmwareVersion","v2.0");b.put("ipAddress","192.0.2.11");row=app.updateGateway(id,b);assertEquals("更新网关名称",row.get("gatewayName"));assertEquals(2L,((Number)row.get("farmId")).longValue());assertEquals("TEST-2",row.get("model"));assertEquals("192.0.2.11",app.gateway(id).get("ipAddress"));app.deleteGateway(id);assertTrue(app.gateways().isEmpty());assertEquals(3,logs());assertEquals("网关测试操作人",jdbc.queryForObject("SELECT operator_name FROM iot_ops_log LIMIT 1",String.class));}
    @Test void duplicateCodesAreRejectedOnCreateAndEdit(){long id=create();assertThrows(IllegalArgumentException.class,()->app.createGateway(body()));var b=body();b.put("gatewayCode","GW-SECOND");long second=((Number)app.createGateway(b).get("id")).longValue();assertThrows(IllegalArgumentException.class,()->app.updateGateway(second,body()));assertEquals(2,logs());assertEquals("GW-TEST",app.gateway(id).get("gatewayCode"));}
    @Test void malformedFarmIdsNeverTruncateOrWrite(){for(Object value:List.of(1.5,0,-1,"abc",true,"9223372036854775808")){var b=body();b.put("farmId",value);assertThrows(IllegalArgumentException.class,()->app.createGateway(b),String.valueOf(value));assertTrue(app.gateways().isEmpty());assertEquals(0,logs());}}
    @Test void invalidFarmEditPreservesOriginal(){long id=create();var b=body();b.put("farmId",2.9);assertThrows(IllegalArgumentException.class,()->app.updateGateway(id,b));assertEquals(1L,((Number)app.gateway(id).get("farmId")).longValue());assertEquals(1,logs());}
    @Test void ipv4ValidationAndEmptyValue(){for(String ip:List.of("256.1.1.1","1.2.3","not-an-ip","::1")){var b=body();b.put("ipAddress",ip);assertThrows(IllegalArgumentException.class,()->app.createGateway(b));assertEquals(0,logs());}var b=body();b.put("ipAddress","");assertEquals("",app.createGateway(b).get("ipAddress"));}
    @Test void missingRequiredValuesNeverWrite(){for(String key:List.of("gatewayCode","gatewayName","protocol","farmId")){var b=body();b.remove(key);assertThrows(IllegalArgumentException.class,()->app.createGateway(b));}assertEquals(0,logs());assertTrue(app.gateways().isEmpty());}
    @Test void foreignFarmAndGatewayCannotBeAccessed(){var b=body();b.put("farmId",999);assertThrows(IllegalArgumentException.class,()->app.createGateway(b));long id=create();when(identity.currentFarmIds()).thenReturn(List.of());assertTrue(app.gateways().isEmpty());assertThrows(RuntimeException.class,()->app.gateway(id));assertThrows(RuntimeException.class,()->app.updateGateway(id,body()));assertThrows(RuntimeException.class,()->app.deleteGateway(id));assertEquals(1,logs());}
    @Test void attachedDevicesPreventDeleteAndMigration(){long id=create();jdbc.update("INSERT INTO iot_device(tenant_id,farm_id,gateway_id,device_code,device_name,online_status) VALUES(2001,1,?,'GW-DEVICE','挂载测试设备','online')",id);assertEquals(1,app.gateway(id).get("totalCount"));assertEquals(1,app.gateway(id).get("onlineCount"));assertThrows(IllegalArgumentException.class,()->app.deleteGateway(id));var b=body();b.put("farmId",2);assertThrows(IllegalArgumentException.class,()->app.updateGateway(id,b));assertEquals(1,logs());}
    @Test void auditFailureRollsBackCreateEditAndDelete(){long id=create();var factory=new org.springframework.aop.framework.ProxyFactory(app);factory.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(new org.springframework.jdbc.datasource.DataSourceTransactionManager(jdbc.getDataSource()),new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));var tx=(IotAppRepository)factory.getProxy();jdbc.execute("ALTER TABLE iot_ops_log ADD CONSTRAINT reject_gateway_log CHECK(action_name NOT IN ('新增边缘网关','编辑边缘网关','删除边缘网关')) NOCHECK");var b=body();b.put("gatewayCode","GW-ROLLBACK");assertThrows(RuntimeException.class,()->tx.createGateway(b));b.put("gatewayName","不应落库");assertThrows(RuntimeException.class,()->tx.updateGateway(id,b));assertThrows(RuntimeException.class,()->tx.deleteGateway(id));assertEquals(1,app.gateways().size());assertEquals("网关配置测试",app.gateway(id).get("gatewayName"));assertEquals(1,logs());}
}
