package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 操作日志。
 *
 * <p>刻意**不继承 BaseEntity**：日志是只追加的事实记录，没有"更新人/更新时间/是否删除"
 * 这些语义 —— 继承过来会平白多出几个永远为空的列。</p>
 */
@Data
@TableName("agri_md_operation_log")
public class OperationLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String module;
    private String operationType;
    private String operationDesc;
    private String targetId;
    private String requestMethod;
    private String requestUri;
    private String operator;
    private Long operatorId;
    private String ipAddress;
    private String params;
    private String result;
    private String errorMessage;
    private Long durationMs;
    private String tenantId;
    private LocalDateTime createTime;
}
