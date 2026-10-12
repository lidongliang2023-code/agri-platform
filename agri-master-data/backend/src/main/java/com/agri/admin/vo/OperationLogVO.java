package com.agri.admin.vo;

import lombok.Data;

/**
 * 操作日志（运营端「权限审计 → 操作日志」）。
 *
 * <p>字段名与页面的绑定一一对应（username / operationType / operationDesc / module /
 * targetId / ipAddress / createTime）—— 原先复用 PermissionChangeLogVO，
 * 而那个 VO 的 operator / changeType / targetType 与页面读的字段全不同，
 * 结果是"接口返回 200、每一列却都是空的"。</p>
 */
@Data
public class OperationLogVO {

    private Long id;
    private String username;
    private String operationType;
    private String operationDesc;
    private String module;
    private String targetId;
    private String ipAddress;
    private String result;
    private Long durationMs;
    private String errorMessage;
    private String createTime;
}
