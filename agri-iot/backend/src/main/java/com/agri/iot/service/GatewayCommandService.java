package com.agri.iot.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.*;

/** 同一控制台账承载申请、下发与网关回执；不推断物理执行结果。 */
@Service
public class GatewayCommandService {
    private final JdbcTemplate jdbc;
    public GatewayCommandService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Transactional
    public Map<String,Object> register(long gatewayId,String name,String action,String operator) {
        if(!"重启网关".equals(action))
            throw new IllegalArgumentException("不支持的网关动作，仅支持重启网关");
        if(jdbc.queryForList("SELECT id FROM iot_gateway WHERE id=? FOR UPDATE",gatewayId).isEmpty())throw new IllegalArgumentException("网关不存在");
        expire(gatewayId);
        var pending=jdbc.queryForList("SELECT command_no FROM iot_gateway_command WHERE gateway_id=? AND command_status IN ('PENDING','SENT') ORDER BY id LIMIT 1",gatewayId);
        if(!pending.isEmpty())return Map.of("commandNo",pending.get(0).get("command_no"),"result","EXISTING","message","已有待结束的重启申请，请查看回执，勿重复执行");
        String code="GWC"+UUID.randomUUID().toString().replace("-","");
        jdbc.update("INSERT INTO iot_gateway_command(gateway_id,gateway_name,action_name,operator_name,result_text,created_at,command_no,command_status,expires_at) VALUES(?,?,?,?,?,?,?,?,?)",
                gatewayId,name,action,operator,"申请已登记，等待网关接入端领取",LocalDateTime.now().toString(),code,"PENDING",LocalDateTime.now().plusMinutes(5).toString());
        return Map.of("commandNo",code,"result","PENDING","message","指令申请已保存，等待网关领取与回执；尚未确认执行");
    }
    private void expire(long id) {
        jdbc.update("UPDATE iot_gateway_command SET command_status='TIMEOUT',result_text='指令已超时，网关执行结果未知' WHERE gateway_id=? AND command_status IN ('PENDING','SENT') AND expires_at<?",id,LocalDateTime.now().toString());
    }
    @Transactional
    public List<Map<String,Object>> history(long id,int page,int size) {
        if(page<1||size<1||size>100)throw new IllegalArgumentException("分页范围不合法");
        expire(id);
        return jdbc.queryForList("SELECT command_no AS commandNo, COALESCE(command_status,'LEGACY') AS status,action_name AS action,operator_name AS operator,result_text AS result,created_at AS createdAt,sent_at AS sentAt,receipt_at AS receiptAt,expires_at AS expiresAt FROM iot_gateway_command WHERE gateway_id=? ORDER BY id DESC LIMIT ? OFFSET ?",id,size,Math.multiplyExact(page-1,size));
    }
    @Transactional
    public List<Map<String,Object>> claim(long id) {
        // 网关行锁使同网关领取串行；不跨主体接受网关自报 ID。
        if(jdbc.queryForList("SELECT id FROM iot_gateway WHERE id=? FOR UPDATE",id).isEmpty())throw new IllegalArgumentException("网关不存在");
        expire(id);
        var rows=jdbc.queryForList("SELECT * FROM iot_gateway_command WHERE gateway_id=? AND command_status IN ('PENDING','SENT') ORDER BY id LIMIT 1 FOR UPDATE",id);
        if(rows.isEmpty())return List.of();
        var row=rows.get(0);
        String token=Objects.toString(row.get("dispatch_token"),"");
        if(token.isEmpty())token=UUID.randomUUID().toString();
        jdbc.update("UPDATE iot_gateway_command SET command_status='SENT',dispatch_token=?,sent_at=COALESCE(sent_at,?),result_text='网关接入端已领取，等待执行回执' WHERE id=?",token,LocalDateTime.now().toString(),row.get("id"));
        return List.of(Map.of("commandNo",row.get("command_no"),"action",row.get("action_name"),"dispatchToken",token,"expiresAt",row.get("expires_at")));
    }
    @Transactional
    public Map<String,Object> receipt(long id,String code,String token,String status,String result) {
        if(!Set.of("SUCCEEDED","FAILED").contains(status)||result==null||result.isBlank()||result.length()>300)
            throw new IllegalArgumentException("回执必须为成功或失败，并提供1至300字执行结果");
        var rows=jdbc.queryForList("SELECT * FROM iot_gateway_command WHERE gateway_id=? AND command_no=? FOR UPDATE",id,code);
        if(rows.isEmpty())throw new IllegalArgumentException("网关指令不存在");
        var row=rows.get(0);
        if(token==null||token.isBlank()||!token.equals(row.get("dispatch_token")))throw new IllegalArgumentException("下发令牌不匹配");
        String old=Objects.toString(row.get("command_status"),"");
        if(Set.of("SUCCEEDED","FAILED").contains(old)) {
            if(old.equals(status)&&result.equals(row.get("result_text")))return Map.of("commandNo",code,"status",old);
            throw new IllegalArgumentException("终态回执不允许覆盖");
        }
        if(!old.equals("SENT"))throw new IllegalArgumentException("指令未下发或已超时，不能接收回执");
        if(LocalDateTime.parse(row.get("expires_at").toString()).isBefore(LocalDateTime.now()))
            throw new IllegalArgumentException("指令已超时，执行结果需人工核实");
        jdbc.update("UPDATE iot_gateway_command SET command_status=?,result_text=?,receipt_at=? WHERE id=?",status,result,LocalDateTime.now().toString(),row.get("id"));
        return Map.of("commandNo",code,"status",status);
    }
}
