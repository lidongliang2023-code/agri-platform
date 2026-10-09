package com.agri.platform.internal.message;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 站点内信（消息中心；短信/推送等多端触达器后续扩展）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_message")
public class MessageEntity extends BaseEntity {

    private Long userId;
    private String title;
    private String content;
    /** 0=未读 1=已读 */
    private Integer readFlag;
}
