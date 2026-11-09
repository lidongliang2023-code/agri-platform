package com.agri.iot.repository;
import com.agri.iot.service.OtaCommandService;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class OtaCommandTest {
 JdbcTemplate jdbc;OtaCommandService service;String hash="a".repeat(64);
 @BeforeEach void setup(){
  var ds=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","sa","");jdbc=new JdbcTemplate(ds);
  jdbc.execute("CREATE TABLE iot_gateway(id BIGINT PRIMARY KEY,farm_id BIGINT)");jdbc.update("INSERT INTO iot_gateway VALUES(1,10),(2,20)");
  jdbc.execute("CREATE TABLE iot_firmware(id BIGINT PRIMARY KEY,version_name VARCHAR(40),sha256_text VARCHAR(100),status VARCHAR(30))");jdbc.update("INSERT INTO iot_firmware VALUES(1,'v2',?,'stable')",hash);
  jdbc.execute("CREATE TABLE iot_ota_task(id BIGINT PRIMARY KEY,tenant_id BIGINT,firmware_id BIGINT,firmware_version VARCHAR(40),status VARCHAR(30),target_count INT,success_count INT,failed_count INT)");jdbc.update("INSERT INTO iot_ota_task VALUES(1,2001,1,'v2','scheduled',0,0,0),(2,2001,1,'v2','scheduled',0,0,0)");
  jdbc.execute("ALTER TABLE iot_firmware ADD COLUMN package_url VARCHAR(1000) DEFAULT 'https://firmware.test/v2.bin'");
  jdbc.execute("ALTER TABLE iot_firmware ADD COLUMN firmware_type VARCHAR(40) DEFAULT 'gateway'");
  jdbc.execute("ALTER TABLE iot_firmware ADD COLUMN target_model VARCHAR(80) DEFAULT 'ALL'");
  jdbc.execute("ALTER TABLE iot_firmware ADD COLUMN file_size_bytes BIGINT DEFAULT 1024");
  new ResourceDatabasePopulator(new ClassPathResource("schema-patch-ota-receipt.sql")).execute(ds);service=new OtaCommandService(jdbc);
 }
 List<Map<String,Object>> farms(){return List.of(Map.of("id",10,"tenantId","2001"));}
 void start(){service.start(1,List.of(1L),"https://firmware.test/v2.bin","可信运营员",farms());}
 Map<String,String> body(Map<String,Object> claim,String status,int progress){return new HashMap<>(Map.of("dispatchToken",claim.get("dispatchToken").toString(),"status",status,"progress",String.valueOf(progress),"result","执行结果","installedVersion","v2","sha256",hash));}
 @Test void fullFlowPersistsAndAggregates(){start();var c=service.claim(1).get(0);assertEquals(c,service.claim(1).get(0));service.receipt(1,c.get("commandNo").toString(),body(c,"RUNNING",50));assertEquals(50,jdbc.queryForObject("SELECT progress FROM iot_ota_receipt",Integer.class));service.receipt(1,c.get("commandNo").toString(),body(c,"SUCCEEDED",100));service.refreshTasks();assertEquals("completed",jdbc.queryForObject("SELECT status FROM iot_ota_task WHERE id=1",String.class));assertEquals(1,jdbc.queryForObject("SELECT success_count FROM iot_ota_task WHERE id=1",Integer.class));assertTrue(service.claim(1).isEmpty());}
 @Test void targetAndFirmwareFailClosed(){assertThrows(IllegalArgumentException.class,()->service.start(1,List.of(2L),"https://firmware.test/v2","甲",farms()));assertThrows(IllegalArgumentException.class,()->service.start(1,List.of(1L),"http://firmware.test/v2","甲",farms()));jdbc.update("UPDATE iot_firmware SET sha256_text='incomplete'");assertThrows(IllegalArgumentException.class,this::start);assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM iot_ota_receipt",Integer.class));}
 @Test void duplicateAndParallelBlocked(){start();assertThrows(IllegalArgumentException.class,this::start);assertThrows(IllegalArgumentException.class,()->service.start(2,List.of(1L),"https://firmware.test/v2","甲",farms()));}
 @Test void receiptIdentityAndProgress(){start();var c=service.claim(1).get(0);String code=c.get("commandNo").toString();assertThrows(IllegalArgumentException.class,()->service.receipt(2,code,body(c,"RUNNING",10)));var b=body(c,"RUNNING",10);b.put("dispatchToken","forged");assertThrows(IllegalArgumentException.class,()->service.receipt(1,code,b));service.receipt(1,code,body(c,"RUNNING",50));assertThrows(IllegalArgumentException.class,()->service.receipt(1,code,body(c,"RUNNING",40)));}
 @Test void successRequiresVersionHashAndImmutable(){start();var c=service.claim(1).get(0);String code=c.get("commandNo").toString();var b=body(c,"SUCCEEDED",100);b.put("sha256","b".repeat(64));assertThrows(IllegalArgumentException.class,()->service.receipt(1,code,b));b.put("sha256",hash);b.put("installedVersion","v1");assertThrows(IllegalArgumentException.class,()->service.receipt(1,code,b));var ok=body(c,"SUCCEEDED",100);service.receipt(1,code,ok);service.receipt(1,code,ok);assertThrows(IllegalArgumentException.class,()->service.receipt(1,code,body(c,"FAILED",100)));}
 @Test void timeoutIsUnknownNeverRedelivered(){start();var c=service.claim(1).get(0);jdbc.update("UPDATE iot_ota_receipt SET expires_at='2000-01-01T00:00:00'");assertThrows(IllegalArgumentException.class,()->service.receipt(1,c.get("commandNo").toString(),body(c,"SUCCEEDED",100)));assertTrue(service.claim(1).isEmpty());service.refreshTasks();assertEquals("timeout",jdbc.queryForObject("SELECT status FROM iot_ota_task WHERE id=1",String.class));assertEquals("TIMEOUT",service.history(1,1,20).get(0).get("status"));}
 @Test void failedAggregatesAndHistoricalTasksUnchanged(){start();var c=service.claim(1).get(0);service.receipt(1,c.get("commandNo").toString(),body(c,"FAILED",40));service.refreshTasks();assertEquals("failed",jdbc.queryForObject("SELECT status FROM iot_ota_task WHERE id=1",String.class));assertEquals("scheduled",jdbc.queryForObject("SELECT status FROM iot_ota_task WHERE id=2",String.class));assertThrows(IllegalArgumentException.class,()->service.history(1,0,20));}
}
