package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_organization")
public class Organization extends BaseEntity {

    private String orgName;

    private Long parentId;

    private String ancestors;

    private String orgCode;

    private String orgType;

    private String contactPerson;

    private String contactPhone;

    private String address;

    private Integer status;

    private Integer delFlag;

    private String tenantId;
}
