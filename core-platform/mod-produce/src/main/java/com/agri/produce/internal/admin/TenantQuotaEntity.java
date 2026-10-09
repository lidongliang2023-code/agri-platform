package com.agri.produce.internal.admin;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;

/**
 * 租户配额（SaaS 资源上限与用量）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_tenant_quota")
public class TenantQuotaEntity extends ProduceBaseEntity {

    @TableId(value = "quota_id", type = IdType.INPUT)
    private String quotaId;

    /** 租户编码 */
    private String tenantCode;

    /** 租户名称 */
    private String tenantName;

    /** 农场数上限 */
    private Integer farmLimit;

    /** 地块数上限 */
    private Integer plotLimit;

    /** 设备数上限 */
    private Integer deviceLimit;

    /** 用户数上限 */
    private Integer userLimit;

    /** 存储空间上限(GB) */
    private BigDecimal storageLimitGb;

    /** 溯源码上限 */
    private Integer traceCodeLimit;

    /** 日 API 调用上限 */
    private Integer apiCallLimit;

    /** 已用农场数 */
    private Integer usedFarmCount;

    /** 状态 1正常 0停用 */
    private Integer status;
}
