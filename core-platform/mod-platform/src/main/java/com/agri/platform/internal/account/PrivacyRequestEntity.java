package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 隐私与数据申请单（数据导出 / 账号注销）。
 *
 * <p>只记录"申请与流转"，**不代表系统已经真的导出或删除了数据** ——
 * 这两件事都跨多个业务库，需要人工执行；表里存状态是为了让用户看得到进度，
 * 而不是为了假装自动化已经完成。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_privacy_request")
public class PrivacyRequestEntity extends BaseEntity {

    private Long userId;

    /** export / deletion */
    private String requestType;

    private String reason;

    /** 导出范围说明，或注销时需要交代的事项 */
    private String scope;

    /** pending / processing / completed / rejected / cancelled */
    private String status;

    private Long handlerId;
    private String handlerName;
    private LocalDateTime handleTime;
    private String handleRemark;
}
