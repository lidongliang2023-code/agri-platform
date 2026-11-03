package com.agri.platform.internal.uc;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 账号冻结记录（用户中心运营端）。
 *
 * <p>{@code platform_user.status} 只能表达"当前能不能登录"，表达不了"为什么被冻、冻到什么时候、
 * 有没有申诉"。冻了三个月后用户来问，只有这张表答得出来。</p>
 *
 * <p>冻结/解封会**同时**改 {@code platform_user.status}，两处必须一致：
 * status=0 表示冻结中，status=1 表示正常。以本表 status 为准，user.status 只是执行结果。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_uc_account_freeze")
public class AccountFreezeEntity extends BaseEntity {

    private Long userId;
    private String username;

    /** risk / violation / judicial / cancel */
    private String freezeType;

    private String reason;
    private LocalDateTime freezeTime;

    /** NULL 表示永久 */
    private LocalDateTime expireTime;

    /** frozen / unfrozen */
    private String status;

    /**
     * none（未申诉）/ appealing（申诉中）/ accepted（申诉通过，已解封）/ rejected（申诉驳回）
     *
     * <p>驳回后允许再次申诉：状态回到 appealing，理由与时间被覆盖，
     * 因为用户往往是在补充说明后重提，留多条反而让运营不知道看哪条。</p>
     */
    private String appealStatus;

    private String operatorName;
    private LocalDateTime unfreezeTime;
    private String unfreezeRemark;

    /** 用户申诉理由（登录页公开接口写入） */
    private String appealReason;
    private LocalDateTime appealTime;
    private LocalDateTime appealHandleTime;
    /** 运营处理意见；驳回理由会展示给用户 */
    private String appealRemark;
}
