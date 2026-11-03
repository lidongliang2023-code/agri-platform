package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 用户通知偏好（一个用户一行）。
 *
 * <p>只存"想不想收"，不存"怎么发"：站内信已接入（{@code MessageFacade}），
 * 短信/推送渠道尚未接入，这两列的偏好先存着，等消息触达器上线后直接生效。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_notification_setting")
public class NotificationSettingEntity extends BaseEntity {

    /** 平台账号 ID */
    private Long userId;

    /** 站内信开启的类型（逗号分隔） */
    private String inappTypes;

    /** 短信开启的类型（渠道未接入，仅存偏好） */
    private String smsTypes;

    /** 推送开启的类型（渠道未接入，仅存偏好） */
    private String pushTypes;

    /** 免打扰开始 HH:mm */
    private String quietStart;

    /** 免打扰结束 HH:mm */
    private String quietEnd;

    /** realtime / daily / weekly */
    private String digest;
}
