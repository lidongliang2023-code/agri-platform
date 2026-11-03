package com.agri.government.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 监管域的收件箱与执法留痕写入。
 *
 * <p>{@code gov_message} 原先只有 SELECT 和 UPDATE、没有任何 INSERT —— 也就是说
 * 整改下达、预警分派、案件办结、补贴复核这些动作发生后，主体和执法人员<b>收不到任何通知</b>，
 * 页面上的未读红点永远来自五条种子数据，读完就再也不会新增。留痕同理：操作人姓名是代码里的常量，
 * 事后无法按人追溯。这里把两者都变成真实写入。</p>
 */
@Service
public class GovernmentAuditService {

    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final JdbcTemplate jdbc;

    public GovernmentAuditService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 给监管主体发一条站内信（主体端消息列表与未读数按 subject_id 取）。 */
    public void notifySubject(Long subjectId, String type, String title, String content,
                              String bizType, String bizNo) {
        if (subjectId == null) {
            return;
        }
        jdbc.update("INSERT INTO gov_message (user_type,subject_id,assignee_id,message_type,title,content,"
                + "biz_type,biz_no,is_read,created_at) VALUES ('subject',?,?,?, ?,?,?,?,FALSE,?)",
                subjectId, null, type, title, content, bizType, bizNo, LocalDateTime.now().format(TIME));
    }

    /** 给执法人员发一条站内信（移动执法端的收件箱按 assignee_id 取）。 */
    public void notifyInspector(Long assigneeId, String type, String title, String content,
                                String bizType, String bizNo) {
        if (assigneeId == null) {
            return;
        }
        jdbc.update("INSERT INTO gov_message (user_type,subject_id,assignee_id,message_type,title,content,"
                + "biz_type,biz_no,is_read,created_at) VALUES ('inspector',?,?,?,?, ?,?,?,TRUE,?)",
                null, assigneeId, type, title, content, bizType, bizNo, LocalDateTime.now().format(TIME));
    }

    /**
     * 执法与运营动作留痕。
     *
     * <p>操作人一律由调用方从令牌解析后传入（姓名 + gov_user.id），不接受请求参数里自带的操作人 ——
     * 否则留痕就成了可以被随意填写的字段，审计价值为零。</p>
     */
    public void log(String operatorName, Long operatorId, String role, String action,
                    String target, String detail, Long subjectId) {
        jdbc.update("INSERT INTO gov_op_log (operator_name,operator_id,role_name,action_name,target_name,"
                + "subject_id,detail,ip_address,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
                operatorName == null ? "系统" : operatorName, operatorId, role, action, target,
                subjectId, detail, "127.0.0.1", LocalDateTime.now().format(TIME));
    }
}
