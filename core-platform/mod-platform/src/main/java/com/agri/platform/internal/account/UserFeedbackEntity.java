package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 用户意见反馈。
 *
 * <p>为什么单独建表而不是塞进站内信：站内信是"给用户看的通知"，用户可删；
 * 反馈是**留档单据**，要能查历史、统计类型分布、追溯回复人，不能随用户删除而消失。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_user_feedback")
public class UserFeedbackEntity extends BaseEntity {

    private Long userId;

    /** suggestion / bug / complaint / other */
    private String feedbackType;

    private String title;
    private String content;
    private String contact;

    /** 提交时所在页面，便于定位问题 */
    private String pagePath;

    /** pending / replied / closed */
    private String status;

    private String replyContent;
    private Long replierId;
    private String replierName;
    private LocalDateTime replyTime;
}
