package com.agri.production.vo;

import com.agri.production.entity.AiMessage;
import lombok.Data;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * AI 问答消息出参（页面 ChatMessage）。
 *
 * <p>额外带 {@code engine}：本部署的助手回复全部是**规则式应答**（从本服务已有数据里检索后如实回答），
 * 把它放在响应里，页面/联调方才能判断一条回答的可信来源 —— 不标的话，
 * "规则检索出来的数字"与"模型生成的建议"看起来一模一样。</p>
 */
@Data
public class AiMessageVO {

    /** 本部署回复来源（固定值） */
    public static final String ENGINE_RULE_BASED = "rule-based";

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String messageId;
    private String sessionId;
    /** user / assistant */
    private String role;
    private String content;
    /** 引用数据来源（页面暂无此字段，便于排查"这个数字从哪来的"） */
    private List<String> refDocIds;
    /** 回答来源：rule-based */
    private String engine;
    private String createdAt;

    public static AiMessageVO of(AiMessage entity) {
        if (entity == null) {
            return null;
        }
        AiMessageVO vo = new AiMessageVO();
        vo.messageId = entity.getMessageId();
        vo.sessionId = entity.getSessionId();
        vo.role = entity.getRole();
        vo.content = entity.getContent();
        vo.refDocIds = split(entity.getRefDocIds());
        vo.engine = entity.getEngine();
        vo.createdAt = entity.getCreateTime() == null ? null : DATETIME.format(entity.getCreateTime());
        return vo;
    }

    private static List<String> split(String raw) {
        List<String> result = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return result;
        }
        for (String part : raw.split("[,，]")) {
            String item = part.trim();
            if (!item.isEmpty()) {
                result.add(item);
            }
        }
        return result;
    }
}
