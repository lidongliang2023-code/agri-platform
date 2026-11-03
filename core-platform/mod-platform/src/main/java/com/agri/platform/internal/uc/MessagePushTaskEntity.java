package com.agri.platform.internal.uc;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 消息推送任务（用户中心运营端）。
 *
 * <p>一次群发 = 一条任务 + N 条 {@code platform_message}。任务记的是"谁在什么时候对哪个人群
 * 用哪个渠道发了什么"，站内信记的是"某个用户收到了什么"。两者粒度不同，不能互相替代。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_uc_message_push_task")
public class MessagePushTaskEntity extends BaseEntity {

    private String title;
    private String content;
    private String templateCode;

    /** all / realname / enterprise / wholesaler / inactive / cert_expiring */
    private String audience;

    /** station / wechat / sms / app */
    private String channels;

    private Integer targetCount;
    private Integer reachCount;
    private BigDecimal openRate;

    /** queued（待解析人群）/ sending（投递中）/ sent（已完成）/ failed（失败） */
    private String status;

    private LocalDateTime sendTime;
    private String operatorName;

    /** 投递失败原因；status=failed 时有值 */
    private String failReason;
}
