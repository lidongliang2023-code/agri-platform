package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 用户操作日志（面向用户本人的操作流水）。
 *
 * <p>与平台运维审计的区别：这张表按 {@code user_id} 查，只记用户自己能感知的动作；
 * 记日志失败不会影响业务（见 {@code UserOperationLogService#record}）。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_user_operation_log")
public class UserOperationLogEntity extends BaseEntity {

    private Long userId;

    /** 动作编码，如 login / password_change */
    private String action;

    /** 动作中文名（落库固化，避免历史记录随文案调整而变） */
    private String actionLabel;

    /** 操作对象 */
    private String target;

    /** 补充说明 */
    private String detail;

    private String ip;

    private String userAgent;

    /** success / failed */
    private String result;
}
