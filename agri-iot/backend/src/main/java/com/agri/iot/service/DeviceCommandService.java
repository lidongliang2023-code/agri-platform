package com.agri.iot.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

/** 同一控制台账承载申请、下发与设备回执；不推断物理执行结果。 */
@Service
public class DeviceCommandService {
    private final JdbcTemplate jdbc;
    public DeviceCommandService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Transactional
    public Map<String,Object> register(long deviceId,String name,String action,String operator) {
        return register(deviceId,name,action,operator,null);
    }
    @Transactional
    public Map<String,Object> register(long deviceId,String name,String action,String operator,String requestNo) {
        if(action==null||!Set.of("开启设备","关闭设备","重启设备").contains(action))
            throw new IllegalArgumentException("不支持的设备动作，请使用开启设备、关闭设备或重启设备");
        String code=requestNo==null?"CMD"+UUID.randomUUID().toString().replace("-",""):requestNo;
        if(!code.matches("CMD[a-fA-F0-9]{32}"))throw new IllegalArgumentException("提交编号格式不合法，请重新打开设备详情");
        var device=lockDevice(deviceId);
        expire(deviceId);
        var previous=jdbc.queryForList("SELECT * FROM iot_control_log WHERE command_no=?",code);
        if(!previous.isEmpty()) {
            var row=previous.get(0);
            if(((Number)row.get("device_id")).longValue()!=deviceId||!action.equals(row.get("action_name"))||!Objects.equals(operator,row.get("operator_name")))
                throw new IllegalArgumentException("提交编号已使用，不能变更设备、动作或操作人");
            return registered(code,Objects.toString(row.get("command_status"),"LEGACY"));
        }
        if("disabled".equals(device.get("status")))throw new IllegalArgumentException("设备已停用，不能提交控制指令");
        Object capable=device.get("control_capable");
        if(capable!=null&&!Boolean.TRUE.equals(capable)&&!"1".equals(capable.toString()))
            throw new IllegalArgumentException("该设备不支持远程控制");
        var active=jdbc.queryForList("SELECT command_no FROM iot_control_log WHERE device_id=? AND command_status IN ('PENDING','SENT') ORDER BY id LIMIT 1",deviceId);
        if(!active.isEmpty())throw new IllegalArgumentException("设备存在待完成指令，请先刷新回执并核实结果，不能重复或反向下发");
        var now=LocalDateTime.now();
        jdbc.update("INSERT INTO iot_control_log(device_id,device_name,action_name,operator_name,result_text,created_at,command_no,command_status,expires_at) VALUES(?,?,?,?,?,?,?,?,?)",
                deviceId,name,action,operator,"申请已登记，等待设备接入端领取",now.toString(),code,"PENDING",now.plusMinutes(5).toString());
        return registered(code,"PENDING");
    }
    private Map<String,Object> registered(String code,String status) {
        return Map.of("commandNo",code,"result",status,"message","申请已登记，请查看回执；登记不代表设备执行成功");
    }
    private Map<String,Object> lockDevice(long id) {
        var rows=jdbc.queryForList("SELECT * FROM iot_device WHERE id=? FOR UPDATE",id);
        if(rows.isEmpty())throw new IllegalArgumentException("设备不存在");
        return rows.get(0);
    }
    private void expire(long id) {
        String now=LocalDateTime.now().toString();
        jdbc.update("UPDATE iot_control_log SET command_status='EXPIRED',result_text='有效期内未被领取，申请已过期；平台未下发，请核实现场后再申请' WHERE device_id=? AND command_status='PENDING' AND expires_at<=?",id,now);
        jdbc.update("UPDATE iot_control_log SET command_status='TIMEOUT',result_text='接入端已领取但未及时回执，执行结果未知；请核实现场，勿直接重发' WHERE device_id=? AND command_status='SENT' AND expires_at<=?",id,now);
    }
    @Transactional
    public List<Map<String,Object>> history(long id,int page,int size) {
        if(page<1||size<1||size>100)throw new IllegalArgumentException("分页范围不合法");
        lockDevice(id);
        expire(id);
        return jdbc.queryForList("SELECT command_no AS commandNo, COALESCE(command_status,'LEGACY') AS status,action_name AS action,operator_name AS operator,result_text AS result,created_at AS createdAt,sent_at AS sentAt,receipt_at AS receiptAt,expires_at AS expiresAt FROM iot_control_log WHERE device_id=? ORDER BY id DESC LIMIT ? OFFSET ?",id,size,Math.multiplyExact(page-1,size));
    }
    @Transactional
    public List<Map<String,Object>> claim(long id) {
        var device=lockDevice(id);
        expire(id);
        // 停用后不领取新指令；已经领取的指令仍允许幂等查询与回执。
        var rows=jdbc.queryForList("SELECT * FROM iot_control_log WHERE device_id=? AND command_status IN ('PENDING','SENT') ORDER BY id LIMIT 1 FOR UPDATE",id);
        if(rows.isEmpty())return List.of();
        var row=rows.get(0);
        if("disabled".equals(device.get("status"))&&"PENDING".equals(row.get("command_status")))return List.of();
        String token=Objects.toString(row.get("dispatch_token"),"");
        if(token.isEmpty())token=UUID.randomUUID().toString();
        jdbc.update("UPDATE iot_control_log SET command_status='SENT',dispatch_token=?,sent_at=COALESCE(sent_at,?),result_text='设备接入端已领取，等待执行回执' WHERE id=?",token,LocalDateTime.now().toString(),row.get("id"));
        return List.of(Map.of("commandNo",row.get("command_no"),"action",row.get("action_name"),"dispatchToken",token,"expiresAt",row.get("expires_at")));
    }
    @Transactional(noRollbackFor=IllegalArgumentException.class)
    public Map<String,Object> receipt(long id,String code,String token,String status,String result) {
        if(status==null||!Set.of("SUCCEEDED","FAILED").contains(status)||result==null||result.isBlank()||result.length()>300)
            throw new IllegalArgumentException("回执必须为成功或失败，并提供1至300字执行结果");
        lockDevice(id);
        var rows=jdbc.queryForList("SELECT * FROM iot_control_log WHERE device_id=? AND command_no=? FOR UPDATE",id,code);
        if(rows.isEmpty())throw new IllegalArgumentException("设备指令不存在");
        var row=rows.get(0);
        if(token==null||token.isBlank()||!token.equals(row.get("dispatch_token")))throw new IllegalArgumentException("下发令牌不匹配");
        String old=Objects.toString(row.get("command_status"),"");
        if(Set.of("SUCCEEDED","FAILED").contains(old)) {
            if(old.equals(status)&&result.equals(row.get("result_text")))return Map.of("commandNo",code,"status",old);
            throw new IllegalArgumentException("终态回执不允许覆盖");
        }
        expire(id);
        if(!old.equals("SENT")||!LocalDateTime.parse(row.get("expires_at").toString()).isAfter(LocalDateTime.now()))
            throw new IllegalArgumentException("指令未领取或已超时，不能覆盖执行结果；请人工核实现场");
        jdbc.update("UPDATE iot_control_log SET command_status=?,result_text=?,receipt_at=? WHERE id=?",status,result,LocalDateTime.now().toString(),row.get("id"));
        return Map.of("commandNo",code,"status",status);
    }
}
