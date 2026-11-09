package com.agri.iot.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.net.URI;
import java.util.*;

/** OTA事实台账；只有网关回执能够认定结果，不根据心跳推断升级成功。 */
@Service
public class OtaCommandService {
 @org.springframework.beans.factory.annotation.Autowired private FirmwareStorageService firmwareStorage;
 private final JdbcTemplate jdbc;
 public OtaCommandService(JdbcTemplate jdbc){this.jdbc=jdbc;}
 private String now(){return LocalDateTime.now().toString();}
 private Map<String,Object> task(long id){var rows=jdbc.queryForList("SELECT * FROM iot_ota_task WHERE id=? FOR UPDATE",id);if(rows.isEmpty())throw new IllegalArgumentException("升级任务不存在");return rows.get(0);}
 private long number(Object o){return Long.parseLong(String.valueOf(o));}
 @Transactional
 public Map<String,Object> start(long id,List<Long> ids,String requestedUrl,String operator,List<Map<String,Object>> farms){
  var task=task(id);
  if(ids==null||ids.isEmpty()||ids.size()>200||new HashSet<>(ids).size()!=ids.size()||ids.stream().anyMatch(Objects::isNull))throw new IllegalArgumentException("请选择1至200个不重复的目标网关");
  if(!jdbc.queryForList("SELECT id FROM iot_ota_receipt WHERE task_id=?",id).isEmpty())throw new IllegalArgumentException("任务已经生成升级指令，请查看回执，禁止重复下发");
  if(!"scheduled".equals(task.get("status")))throw new IllegalArgumentException("仅待执行任务可启动；历史任务不可推断执行结果");
  var firmware=jdbc.queryForList("SELECT * FROM iot_firmware WHERE id=? FOR UPDATE",task.get("firmware_id"));
  if(firmware.isEmpty())throw new IllegalArgumentException("固件目录不存在");var fw=firmware.get(0);
  String version=Objects.toString(fw.get("version_name"),""),hash=Objects.toString(fw.get("sha256_text"),"");
  if(!"stable".equals(fw.get("status"))||version.isBlank()||!version.equals(task.get("firmware_version"))||!hash.matches("[a-fA-F0-9]{64}"))throw new IllegalArgumentException("须使用稳定固件，版本一致且包含完整SHA-256摘要");
  String url=Objects.toString(fw.get("package_url"),"");
  if(requestedUrl!=null&&!requestedUrl.isBlank()&&!requestedUrl.equals(url))throw new IllegalArgumentException("OTA不得替换已发布固件包地址");
  URI uri;try{uri=URI.create(url);}catch(Exception e){throw new IllegalArgumentException("固件地址无效");}
  if(url==null||url.length()>1000||!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getFragment()!=null)throw new IllegalArgumentException("固件地址须为不含账号和片段的HTTPS地址");
  if(firmwareStorage!=null && firmwareStorage.managed(url))firmwareStorage.verify(url,hash,number(fw.get("file_size_bytes")));
  if(!"gateway".equals(fw.get("firmware_type"))||number(fw.get("file_size_bytes"))<=0)throw new IllegalArgumentException("须使用资料完整的网关固件包");
  for(long gateway:ids.stream().sorted().toList()){
   var gateways=jdbc.queryForList("SELECT * FROM iot_gateway WHERE id=? FOR UPDATE",gateway);if(gateways.isEmpty())throw new IllegalArgumentException("网关不存在");var g=gateways.get(0);
   String model=Objects.toString(fw.get("target_model"),"");
   if(model.isBlank()||(!"ALL".equals(model)&&!model.equals(Objects.toString(g.get("model"),""))))throw new IllegalArgumentException("固件适用型号与目标网关不匹配");
   boolean owned=farms.stream().anyMatch(f->Objects.toString(f.get("id"),"").equals(Objects.toString(g.get("farm_id"),""))&&Objects.toString(f.get("tenantId"),"").equals(Objects.toString(task.get("tenant_id"),"")));
   if(!owned)throw new IllegalArgumentException("目标网关农场不属于任务主体或当前运营账号不可核验");
   expire(gateway);
   if(!jdbc.queryForList("SELECT id FROM iot_ota_receipt WHERE gateway_id=? AND command_status IN ('PENDING','SENT','RUNNING')",gateway).isEmpty())throw new IllegalArgumentException("网关已有未结束升级，请勿并行下发");
   jdbc.update("INSERT INTO iot_ota_receipt(task_id,gateway_id,command_no,command_status,firmware_version,firmware_url,sha256_text,operator_name,created_at,expires_at,result_text) VALUES(?,?,?,?,?,?,?,?,?,?,?)",id,gateway,"OTA"+UUID.randomUUID().toString().replace("-",""),"PENDING",version,url,hash.toLowerCase(Locale.ROOT),operator,now(),LocalDateTime.now().plusMinutes(30).toString(),"等待网关领取，尚未确认执行");
  }
  jdbc.update("UPDATE iot_ota_task SET status='running',target_count=?,success_count=0,failed_count=0 WHERE id=?",ids.size(),id);
  return Map.of("taskId",id,"targetCount",ids.size(),"message","升级申请已保存，等待网关校验固件并执行回执");
 }
 private void expire(long gateway){jdbc.update("UPDATE iot_ota_receipt SET command_status='TIMEOUT',result_text='升级超时，执行结果未知，须人工核实' WHERE gateway_id=? AND command_status IN ('PENDING','SENT','RUNNING') AND expires_at<?",gateway,now());}
 @Transactional
 public List<Map<String,Object>> history(long gateway,int page,int size){
  if(page<1||size<1||size>100)throw new IllegalArgumentException("分页参数无效");expire(gateway);
  return jdbc.queryForList("SELECT command_no AS commandNo,command_status AS status,firmware_version AS action,operator_name AS operator,result_text AS result,created_at AS createdAt,sent_at AS sentAt,receipt_at AS receiptAt,expires_at AS expiresAt,progress,installed_version AS installedVersion FROM iot_ota_receipt WHERE gateway_id=? ORDER BY id DESC LIMIT ? OFFSET ?",gateway,size,Math.multiplyExact(page-1,size));
 }
 @Transactional
 public List<Map<String,Object>> claim(long gateway){
  if(jdbc.queryForList("SELECT id FROM iot_gateway WHERE id=? FOR UPDATE",gateway).isEmpty())throw new IllegalArgumentException("网关不存在");expire(gateway);
  var rows=jdbc.queryForList("SELECT * FROM iot_ota_receipt WHERE gateway_id=? AND command_status IN ('PENDING','SENT','RUNNING') ORDER BY id LIMIT 1 FOR UPDATE",gateway);
  if(rows.isEmpty())return List.of();var row=rows.get(0);String token=Objects.toString(row.get("dispatch_token"),UUID.randomUUID().toString());
  jdbc.update("UPDATE iot_ota_receipt SET command_status=CASE WHEN command_status='PENDING' THEN 'SENT' ELSE command_status END,dispatch_token=?,sent_at=COALESCE(sent_at,?) WHERE id=?",token,now(),row.get("id"));
  return List.of(Map.of("commandNo",row.get("command_no"),"dispatchToken",token,"version",row.get("firmware_version"),"firmwareUrl",row.get("firmware_url"),"sha256",row.get("sha256_text"),"expiresAt",row.get("expires_at")));
 }
 @Transactional
 public Map<String,Object> receipt(long gateway,String code,Map<String,String> body){
  String status=body.getOrDefault("status",""),result=body.get("result"),token=body.get("dispatchToken"),version=body.getOrDefault("installedVersion","");
  int progress;try{progress=Integer.parseInt(body.getOrDefault("progress","-1"));}catch(Exception e){throw new IllegalArgumentException("升级进度必须为整数");}
  if(!Set.of("RUNNING","SUCCEEDED","FAILED").contains(status)||progress<0||progress>100||result==null||result.isBlank()||result.length()>300||version.length()>40)throw new IllegalArgumentException("回执状态、进度或结果不合法");
  var rows=jdbc.queryForList("SELECT * FROM iot_ota_receipt WHERE gateway_id=? AND command_no=? FOR UPDATE",gateway,code);if(rows.isEmpty())throw new IllegalArgumentException("升级指令不属于该网关");var row=rows.get(0);
  if(token==null||!token.equals(row.get("dispatch_token"))||row.get("dispatch_token")==null)throw new IllegalArgumentException("领取令牌不匹配");
  String old=String.valueOf(row.get("command_status"));
  if(Set.of("SUCCEEDED","FAILED").contains(old)){
   if((!"SUCCEEDED".equals(status)||Objects.toString(body.get("sha256"),"").equalsIgnoreCase(String.valueOf(row.get("sha256_text"))))&&old.equals(status)&&result.equals(row.get("result_text"))&&progress==number(row.get("progress"))&&version.equals(Objects.toString(row.get("installed_version"),"")))return Map.of("status",old,"commandNo",code);
   throw new IllegalArgumentException("终态回执不可改写");
  }
  if("TIMEOUT".equals(old)||now().compareTo(String.valueOf(row.get("expires_at")))>0)throw new IllegalArgumentException("升级已超时，结果未知，请人工核实");
  if(!Set.of("SENT","RUNNING").contains(old)||progress<number(row.get("progress")))throw new IllegalArgumentException("进度不能回退或未领取");
  if("SUCCEEDED".equals(status)&& (progress!=100||!version.equals(row.get("firmware_version"))||!Objects.toString(body.get("sha256"),"").equalsIgnoreCase(String.valueOf(row.get("sha256_text")))))throw new IllegalArgumentException("成功回执须为100%，且安装版本和SHA-256与目标一致");
  jdbc.update("UPDATE iot_ota_receipt SET command_status=?,progress=?,installed_version=?,result_text=?,receipt_at=? WHERE id=?",status,progress,version,result,now(),row.get("id"));
  return Map.of("status",status,"commandNo",code);
 }
 /** 各任务按独立回执实时汇总，未接入的新旧任务不伪造完成数。 */
 @Transactional
 public void refreshTasks(){
  jdbc.update("UPDATE iot_ota_receipt SET command_status='TIMEOUT',result_text='升级超时，执行结果未知，须人工核实' WHERE command_status IN ('PENDING','SENT','RUNNING') AND expires_at<?",now());
  for(var row:jdbc.queryForList("SELECT task_id,COUNT(*) AS total,SUM(CASE WHEN command_status='SUCCEEDED' THEN 1 ELSE 0 END) AS ok,SUM(CASE WHEN command_status='FAILED' THEN 1 ELSE 0 END) AS bad,SUM(CASE WHEN command_status='TIMEOUT' THEN 1 ELSE 0 END) AS timed,SUM(CASE WHEN command_status IN ('PENDING','SENT','RUNNING') THEN 1 ELSE 0 END) AS pending FROM iot_ota_receipt GROUP BY task_id")){
   String state=number(row.get("pending"))>0?"running":number(row.get("timed"))>0?"timeout":number(row.get("bad"))>0?"failed":"completed";
   jdbc.update("UPDATE iot_ota_task SET target_count=?,success_count=?,failed_count=?,status=? WHERE id=?",row.get("total"),row.get("ok"),row.get("bad"),state,row.get("task_id"));
  }
 }
}
