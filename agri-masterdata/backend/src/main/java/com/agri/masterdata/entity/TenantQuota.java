package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_tenant_quota")
public class TenantQuota extends BaseEntity {

    private String tenantId;

    private String quotaType;

    private Integer maxValue;

    private Integer currentValue;

    private Integer status;
}