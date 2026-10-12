package com.agri.admin.vo;

import lombok.Data;

/**
 * 租户配额总览行（运营端「租户管理 → 配额管理」列表的一行）。
 *
 * <p>这是**读模型**，不是实体：页面需要的是"租户 + 它的配额用量"这一行，
 * 而库里是 `agri_md_tenant` 与 `agri_md_tenant_quota` 两张表，所以由服务层合并后返回。</p>
 *
 * <p><b>存储单位是字节（Long）</b>，与 `TenantPackageVO.storageLimit` 保持一致。
 * 页面上按 GB 展示由前端换算 —— 接口层不换单位，否则同一个平台里
 * "存储配额"一个接口给字节、另一个给 GB，下一个人必然算错量级。</p>
 */
@Data
public class TenantQuotaOverviewVO {

    /** 租户 ID */
    private Long id;

    /** 租户编码 */
    private String tenantCode;

    /** 租户名称 */
    private String tenantName;

    /** 租户类型：ENTERPRISE / COOPERATIVE / INDIVIDUAL … */
    private String tenantType;

    /**
     * 该租户是否已配置配额记录。
     *
     * <p>没有配额行时下面各限额都是 0，界面上会显示成"配额为 0"（像是被限死了），
     * 与"还没配"完全是两回事，所以单给一个标志让页面区分。</p>
     */
    private Boolean hasQuota;

    private Integer userUsed;
    private Integer userLimit;

    private Integer orgUsed;
    private Integer orgLimit;

    private Integer productUsed;
    private Integer productLimit;

    /** 已用存储（字节） */
    private Long storageUsed;

    /** 存储配额（字节） */
    private Long storageLimit;

    private Integer apiUsed;
    private Integer apiLimit;
}
