package com.agri.iot.service;

import com.agri.iot.integration.IotIdentityService;
import com.agri.iot.support.SamplingPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DeviceSamplingServiceTest {
    JdbcTemplate jdbc; IotIdentityService identity; DeviceSamplingService service;
    static final String ORIGINAL="{\"reportInterval\":30,\"samplingToleranceSeconds\":5,\"samplingEffectiveAt\":\"2026-11-13T10:00:00\",\"custom\":\"keep\"}";
    @BeforeEach void setup(){
        jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa",""));
        jdbc.execute("CREATE TABLE iot_device(id BIGINT PRIMARY KEY,device_code VARCHAR(60),type_name VARCHAR(100),config_text VARCHAR(1000))");
        jdbc.execute("CREATE TABLE iot_device_type(type_name VARCHAR(100),property_text VARCHAR(400))");
        jdbc.execute("CREATE TABLE iot_ops_log(id BIGINT AUTO_INCREMENT PRIMARY KEY,operator_name VARCHAR(100),action_name VARCHAR(80),target_name VARCHAR(100),detail_text VARCHAR(1000),ip_address VARCHAR(80),created_at VARCHAR(80))");
        jdbc.update("INSERT INTO iot_device VALUES(1,'SAMPLING-TEST','温湿度',?)",ORIGINAL);
        jdbc.update("INSERT INTO iot_device_type VALUES('温湿度','temperature,humidity')");
        identity=mock(IotIdentityService.class);when(identity.requireOperatorName()).thenReturn("测试操作人");
        service=new DeviceSamplingService(jdbc,identity);
    }
    Map<String,Object> body(Object interval,Object tolerance,List<?> metrics){var b=new HashMap<String,Object>();b.put("intervalSeconds",interval);b.put("toleranceSeconds",tolerance);b.put("metrics",metrics);return b;}
    Map<String,Object> metric(boolean enabled,Object interval,Object tolerance){var m=new HashMap<String,Object>();m.put("metricKey","temperature");m.put("enabled",enabled);m.put("intervalSeconds",interval);m.put("toleranceSeconds",tolerance);return m;}
    String config(){return jdbc.queryForObject("SELECT config_text FROM iot_device WHERE id=1",String.class);}
    void unchanged(){assertEquals(ORIGINAL,config());assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ops_log",Integer.class));}
    @SuppressWarnings("unchecked") Map<String,Object> first(Map<String,Object> r){return ((List<Map<String,Object>>)r.get("metrics")).get(0);}
    @Test void getUsesDefaultForUnconfiguredMetrics(){var r=service.get(1,false);assertEquals(30,r.get("intervalSeconds"));assertEquals(35L,first(r).get("maxGapSeconds"));assertEquals(false,first(r).get("enabled"));verify(identity).requireDeviceAccess(1);unchanged();}
    @Test void saveOverridePreservesExtensionsAndAuditActor(){var r=service.save(1,body(60,6,List.of(metric(true,10,2))),false);assertEquals(10,first(r).get("effectiveIntervalSeconds"));assertEquals(12L,first(r).get("maxGapSeconds"));assertTrue(config().contains("\"custom\":\"keep\""));assertEquals("测试操作人",jdbc.queryForObject("SELECT operator_name FROM iot_ops_log",String.class));assertTrue(jdbc.queryForObject("SELECT detail_text FROM iot_ops_log",String.class).contains("未下发硬件配置"));verify(identity,atLeastOnce()).requireDeviceAccess(1);}
    @Test void disablingOverrideFallsBackToDefault(){service.save(1,body(30,5,List.of(metric(true,10,2))),true);var r=service.save(1,body(30,5,List.of(metric(false,10,2))),true);assertFalse((Boolean)first(r).get("enabled"));assertEquals(30,first(r).get("effectiveIntervalSeconds"));assertEquals(35L,first(r).get("maxGapSeconds"));}
    @Test void disableDefaultKeepsIndependentMetric(){var r=service.save(1,body(null,0,List.of(metric(true,10,2))),true);assertNull(r.get("intervalSeconds"));assertEquals(10,first(r).get("effectiveIntervalSeconds"));}
    @Test void samePolicyPreservesEffectiveTime(){service.save(1,body(30,5,List.of()),true);assertEquals("2026-11-13T10:00",SamplingPolicy.read(config()).effectiveAt().toString());}
    @Test void invalidDefaultNumbersNeverWrite(){for(Object n:List.of(0,-1,86401,1.5,"30",true)){assertThrows(IllegalArgumentException.class,()->service.save(1,body(n,0,List.of()),true));unchanged();}for(Object n:List.of(-1,31,0.5,"5",true)){assertThrows(IllegalArgumentException.class,()->service.save(1,body(30,n,List.of()),true));unchanged();}}
    @Test void missingDefaultCannotSilentlyClear(){assertThrows(IllegalArgumentException.class,()->service.save(1,Map.of("metrics",List.of()),true));unchanged();}
    @Test void malformedMetricCollectionCannotBeIgnored(){for(Object value:List.of("bad",Map.of("temperature",10),5)){var b=body(60,5,List.of());b.put("metrics",value);assertThrows(IllegalArgumentException.class,()->service.save(1,b,true));unchanged();}}
    @Test void enabledMetricRequiresInterval(){assertThrows(IllegalArgumentException.class,()->service.save(1,body(30,5,List.of(metric(true,null,0))),true));unchanged();}
    @Test void metricEnabledMustBeBoolean(){var m=metric(true,10,2);m.put("enabled","yes");assertThrows(IllegalArgumentException.class,()->service.save(1,body(30,5,List.of(m)),true));unchanged();}
    @Test void duplicateMetricsAreRejected(){assertThrows(IllegalArgumentException.class,()->service.save(1,body(30,5,List.of(metric(true,10,2),metric(true,20,2))),true));unchanged();}
    @Test void metricBoundsAreValidated(){for(Object n:List.of(0,-1,86401,1.5,"10",true)){assertThrows(IllegalArgumentException.class,()->service.save(1,body(30,5,List.of(metric(true,n,0))),true));unchanged();}assertThrows(IllegalArgumentException.class,()->service.save(1,body(30,5,List.of(metric(true,10,11))),true));unchanged();}
    @Test void boundaryValuesRoundTrip(){assertEquals(1,service.save(1,body(1,0,List.of()),true).get("intervalSeconds"));assertEquals(172800L,service.save(1,body(86400,86400,List.of(metric(true,86400,86400))),true).get("maxGapSeconds"));}
    @Test void foreignDeviceAndMissingDeviceCannotWrite(){doThrow(new IllegalArgumentException("跨主体拒绝")).when(identity).requireDeviceAccess(1);assertThrows(IllegalArgumentException.class,()->service.save(1,body(60,0,List.of()),false));assertThrows(IllegalArgumentException.class,()->service.get(1,false));assertThrows(RuntimeException.class,()->service.save(999,body(60,0,List.of()),true));unchanged();}
    @Test void auditFailureRollsBackConfig(){var factory=new org.springframework.aop.framework.ProxyFactory(service);factory.addAdvice(new org.springframework.transaction.interceptor.TransactionInterceptor(new org.springframework.jdbc.datasource.DataSourceTransactionManager(jdbc.getDataSource()),new org.springframework.transaction.annotation.AnnotationTransactionAttributeSource()));var transactional=(DeviceSamplingService)factory.getProxy();jdbc.execute("ALTER TABLE iot_ops_log ADD CONSTRAINT reject_sampling CHECK(action_name <> '修改采样配置')");assertThrows(RuntimeException.class,()->transactional.save(1,body(60,0,List.of()),true));unchanged();}
}
