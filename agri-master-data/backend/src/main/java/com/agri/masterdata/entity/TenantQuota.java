package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_tenant_quota")
public class TenantQuota extends BaseEntity {

    private String tenantId;

    private String quotaType;

    private Integer userLimit;

    private Integer usedUsers;

    private Integer orgLimit;

    private Integer usedOrgs;

    private Integer productLimit;

    private Integer usedProducts;

    private Long storageLimit;

    private Long usedStorage;

    private Integer apiLimit;

    private Integer usedApi;

    private Integer maxValue;

    private Integer currentValue;

    private Integer status;
}