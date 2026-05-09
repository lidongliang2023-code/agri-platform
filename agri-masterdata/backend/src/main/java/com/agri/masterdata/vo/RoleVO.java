package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class RoleVO {

    private Long id;

    private String roleCode;

    private String roleName;

    private String roleKey;

    private Integer roleSort;

    private Integer dataScope;

    private String dataScopeName;

    private Integer status;

    private List<Long> menuIds;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String updateBy;

    private LocalDateTime updateTime;

    private String remark;
}
