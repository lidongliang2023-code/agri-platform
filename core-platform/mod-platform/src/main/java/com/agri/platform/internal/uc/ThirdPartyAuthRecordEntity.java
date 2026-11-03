package com.agri.platform.internal.uc;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 第三方授权流水（用户中心运营端）。
 *
 * <p>{@code platform_user_binding} 只保留当前绑定状态，解绑后记录即被覆盖；
 * 合规要求"用户授权/撤回要可追溯"，因此另存流水。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_uc_third_party_auth_record")
public class ThirdPartyAuthRecordEntity extends BaseEntity {

    private Long userId;
    private String userName;
    private Long appId;
    private String appName;
    private String scopes;

    /** grant / revoke */
    private String action;

    private String ip;
}
