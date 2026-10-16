package com.agri.production.vo;

import com.agri.production.entity.AiSession;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/** AI 问答会话出参（页面 ChatSession）。 */
@Data
public class AiSessionVO {

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String sessionId;
    private String title;
    /** 最后一条消息摘要（页面左栏副标题） */
    private String lastMessage;
    private Integer messageCount;
    private String createdAt;
    private String updatedAt;

    public static AiSessionVO of(AiSession entity, String lastMessage) {
        if (entity == null) {
            return null;
        }
        AiSessionVO vo = new AiSessionVO();
        vo.sessionId = entity.getSessionId();
        vo.title = entity.getTitle();
        vo.lastMessage = lastMessage;
        vo.messageCount = entity.getMessageCount();
        vo.createdAt = entity.getCreateTime() == null ? null : DATETIME.format(entity.getCreateTime());
        vo.updatedAt = entity.getUpdateTime() == null ? null : DATETIME.format(entity.getUpdateTime());
        return vo;
    }
}
