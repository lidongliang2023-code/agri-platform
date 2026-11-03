package com.agri.platform.internal.uc;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 消息模板（用户中心运营端）。
 *
 * <p>{@code platform_message} 是**收件箱**（谁收到了什么），本表是**模板**（发之前长什么样）。
 * 合表会让每条站内信都冗余一份模板正文，且模板改了历史消息跟着变。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_uc_message_template")
public class MessageTemplateEntity extends BaseEntity {

    private String code;

    /** cert_audit / security / cert_expire / identity / privacy */
    private String scene;

    /** 适用渠道，逗号分隔 */
    private String channels;

    private String title;
    private String content;

    /** 可用变量，逗号分隔 */
    private String variables;

    /** enabled / disabled */
    private String status;
}
