package com.agri.iot.repository;

import com.agri.iot.service.GatewayCommandService;
import com.agri.iot.controller.GatewayReceiptController;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class GatewayCommandTest {
 JdbcTemplate jdbc; GatewayCommandService service;
 @BeforeEach void setup(){
  jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","sa",""));
  jdbc.execute("CREATE TABLE iot_gateway(id BIGINT PRIMARY KEY)"); jdbc.update("INSERT INTO iot_gateway VALUES(1),(2)");
  jdbc.execute("CREATE TABLE iot_gateway_command(id BIGINT AUTO_INCREMENT PRIMARY KEY,gateway_id BIGINT,gateway_name VARCHAR(160),action_name VARCHAR(120),operator_name VARCHAR(80),result_text VARCHAR(300),created_at VARCHAR(40),command_no VARCHAR(40) UNIQUE,command_status VARCHAR(20),dispatch_token VARCHAR(64),expires_at VARCHAR(40),sent_at VARCHAR(40),receipt_at VARCHAR(40))");
  service=new GatewayCommandService(jdbc);
 }
 String register(){return service.register(1,"水泵","重启网关","真实操作人").get("commandNo").toString();}
 @Test void registerClaimAndReceiptPersists(){
  String code=register();assertEquals("PENDING",service.history(1,1,20).get(0).get("status"));
  var first=service.claim(1).get(0);assertEquals(first,service.claim(1).get(0));
  service.receipt(1,code,first.get("dispatchToken").toString(),"SUCCEEDED","设备返回开启完成");
  assertEquals("SUCCEEDED",service.history(1,1,20).get(0).get("status"));
  assertNotNull(jdbc.queryForObject("SELECT receipt_at FROM iot_gateway_command",String.class));
 }
 @Test void terminalReceiptIsIdempotentButImmutable(){
  String code=register(),token=service.claim(1).get(0).get("dispatchToken").toString();
  service.receipt(1,code,token,"FAILED","硬件故障");service.receipt(1,code,token,"FAILED","硬件故障");
  assertThrows(IllegalArgumentException.class,()->service.receipt(1,code,token,"SUCCEEDED","改为成功"));
  assertTrue(service.claim(1).isEmpty());
 }
 @Test void cannotReceiptOtherDeviceOrBeforeClaim(){
  String code=register();assertThrows(IllegalArgumentException.class,()->service.receipt(1,code,"x","SUCCEEDED","成功"));
  String token=service.claim(1).get(0).get("dispatchToken").toString();
  assertThrows(IllegalArgumentException.class,()->service.receipt(2,code,token,"SUCCEEDED","成功"));
  assertThrows(IllegalArgumentException.class,()->service.receipt(1,code,"forged","SUCCEEDED","成功"));
 }
 @Test void expiredCommandsNeverDispatchOrAcceptReceipt(){
  String code=register(),token=service.claim(1).get(0).get("dispatchToken").toString();
  jdbc.update("UPDATE iot_gateway_command SET expires_at='2000-01-01T00:00:00'");
  assertThrows(IllegalArgumentException.class,()->service.receipt(1,code,token,"SUCCEEDED","迟到回执"));
  assertTrue(service.claim(1).isEmpty());assertEquals("TIMEOUT",service.history(1,1,20).get(0).get("status"));
 }
 @Test void legacyAndPaginationAreExplicit(){
  jdbc.update("INSERT INTO iot_gateway_command(gateway_id,action_name) VALUES(1,'历史动作')");
  assertEquals("LEGACY",service.history(1,1,20).get(0).get("status"));
  assertThrows(IllegalArgumentException.class,()->service.history(1,0,20));
  assertThrows(IllegalArgumentException.class,()->service.register(1,"水泵","任意脚本","甲"));
 }
 @Test void deviceKeysFailClosedAndAreBoundToDevice() throws Exception {
  var controller=new GatewayReceiptController(service,"{\"1\":\"01234567890123456789012345678901\"}",new ObjectMapper());
  assertThrows(ResponseStatusException.class,()->controller.claim(1,null));
  assertThrows(ResponseStatusException.class,()->controller.claim(2,"01234567890123456789012345678901"));
  assertNotNull(controller.claim(1,"01234567890123456789012345678901"));
 }
 @Test void repeatRequestUsesOnePendingCommandAndDoesNotMutateHeartbeat(){
  jdbc.execute("ALTER TABLE iot_gateway ADD COLUMN online_status VARCHAR(20)");
  jdbc.update("UPDATE iot_gateway SET online_status='offline'");
  String code=register();assertEquals(code,register());
  assertEquals(1,jdbc.queryForObject("SELECT COUNT(*) FROM iot_gateway_command",Integer.class));
  var dispatched=service.claim(1).get(0);
  assertEquals(code,register());
  service.receipt(1,code,dispatched.get("dispatchToken").toString(),"SUCCEEDED","重启后接入端报告完成");
  assertEquals("offline",jdbc.queryForObject("SELECT online_status FROM iot_gateway WHERE id=1",String.class));
  assertNotEquals(code,register());
 }
}
