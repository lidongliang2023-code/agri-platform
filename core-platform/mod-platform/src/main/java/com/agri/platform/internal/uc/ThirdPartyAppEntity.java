package com.agri.platform.internal.uc;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 第三方应用档案（用户中心运营端）。
 *
 * <p>和 {@code platform_user_binding} 的区别：binding 记的是"某用户绑了某渠道的某个外部账号"，
 * 是**用户侧**的当前态；本表记的是"哪个应用被允许接入、能拿哪些 scope"，
 * 是**平台侧**的准入档案。两者的键不同（provider vs app_key），不能合并。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_uc_third_party_app")
public class ThirdPartyAppEntity extends BaseEntity {

    private String appKey;
    private String appName;

    /** internal / partner / open */
    private String appType;

    private String applicant;
    private String contactName;
    private String contactPhone;

    /** 授权范围，逗号分隔 */
    private String scopes;

    private String redirectUri;

    /** pending / online / rejected / offline */
    private String status;

    private Long callCount;
    private LocalDateTime lastCallAt;

    private String reviewerName;
    private LocalDateTime reviewTime;
    private String reviewRemark;
}
