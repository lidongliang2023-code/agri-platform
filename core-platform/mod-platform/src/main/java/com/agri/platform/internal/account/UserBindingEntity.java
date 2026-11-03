package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 用户第三方账号绑定。
 *
 * <p>一个用户对同一渠道只保留一条有效绑定（{@code (user_id, provider)} 唯一）；
 * 解绑走逻辑删除，便于留痕与后续重新绑定。</p>
 *
 * <p><b>口径</b>：本部署未接入第三方 OAuth，这里记录的是"外部账号标识"
 * （openid / unionid / 手机号等），由用户在页面上登记，供后续登录与消息推送对账使用。
 * 不代表已经完成过授权握手。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_user_binding")
public class UserBindingEntity extends BaseEntity {

    /** 平台账号 ID */
    private Long userId;

    /** 第三方渠道：wechat / alipay / dingtalk */
    private String provider;

    /** 外部账号标识（openid / unionid / 手机号等） */
    private String externalAccount;

    /** 外部账号昵称，仅用于页面展示 */
    private String displayName;

    /** bound / unbound */
    private String bindStatus;

    /** 绑定时间 */
    private java.time.LocalDateTime bindAt;

    /** 解绑时间 */
    private java.time.LocalDateTime unbindAt;

    /** 备注 */
    private String remark;
}
