package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 证照到期提醒发送记录。
 *
 * <p>(certId, windowKey, userId) 唯一：同一张证照、同一档提醒对同一个用户只发一次，
 * 否则每日扫描会变成每日重复骚扰。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_cert_reminder")
public class CertificateReminderEntity extends BaseEntity {

    private Long certId;

    private Long merchantId;

    private Long userId;

    /** D30 = 30 天内到期；EXPIRED = 已过期 7 天内 */
    private String windowKey;

    private LocalDateTime sentAt;
}
