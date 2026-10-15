package com.agri.production.vo;

import com.agri.production.entity.MessageNotify;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 消息中心出参（页面 {@code MessageItem}）。
 *
 * <p>两处刻意的映射：</p>
 * <ul>
 *   <li>{@code msg_type} 的**字符串**归一成页面用的 1~4（1 系统 / 2 任务 / 3 告警 / 4 审批）——
 *       页面的 {@code normalizeMessageType} 只把 QUALITY 当审批通知（原型口径），后端照这个口径出数，
 *       两处不一致时以页面的展示为准；</li>
 *   <li>{@code read_flag} 的 0/1 转成布尔 {@code isRead}：页面用 {@code item.isRead} 做未读高亮与角标计数，
 *       给 0/1 会让"已读"判定恒为真（0 也是 truthy 除外，但字符串 '0' 就恒为真了）。</li>
 * </ul>
 */
@Data
public class UserMessageVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String messageId;
    private String title;
    private String content;
    /** 1 系统通知 / 2 任务提醒 / 3 告警通知 / 4 审批通知 */
    private Integer messageType;
    private Boolean isRead;
    private String linkPath;
    private String bizId;
    /** 发送时间 yyyy-MM-dd HH:mm:ss */
    private String createdAt;
    /** 阅读时间，未读为 null */
    private String readAt;

    public static UserMessageVO of(MessageNotify entity) {
        if (entity == null) {
            return null;
        }
        UserMessageVO vo = new UserMessageVO();
        vo.messageId = entity.getMessageId();
        vo.title = entity.getTitle();
        vo.content = entity.getContent();
        vo.messageType = typeCodeOf(entity.getMsgType());
        vo.isRead = Integer.valueOf(1).equals(entity.getReadFlag());
        vo.linkPath = entity.getLinkPath();
        vo.bizId = entity.getBizId();
        vo.createdAt = entity.getSentAt() == null ? null : DATE_TIME.format(entity.getSentAt());
        vo.readAt = entity.getReadAt() == null ? null : DATE_TIME.format(entity.getReadAt());
        return vo;
    }

    /**
     * 消息类型字符串 → 页面数值编码。
     *
     * <p>映射与前端 {@code utils/production-adapter.ts#normalizeMessageType} 完全一致：
     * TASK→2、ALERT→3、QUALITY/AUDIT/APPROVAL→4、其余（SYSTEM 及未知）→1。
     * 两边都写一份不是重复：后端要给"按类型筛选"用同一套口径，前端要处理**平台侧老数据**，
     * 这份单向映射是两边的共同定义，改一处必须两处一起改（注释里写死，避免下次只改一边）。</p>
     */
    private static Integer typeCodeOf(String msgType) {
        String text = msgType == null ? "" : msgType.trim().toUpperCase();
        return switch (text) {
            case "TASK" -> 2;
            case "ALERT" -> 3;
            case "QUALITY", "AUDIT", "APPROVAL" -> 4;
            default -> 1;
        };
    }
}
