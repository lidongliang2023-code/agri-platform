package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class DepartmentVO {

    private String deptId;

    private String deptCode;

    private String deptName;

    private String parentDeptId;

    private String parentDeptName;

    private String orgId;

    private String orgName;

    private String deptManager;

    private String deptManagerName;

    private String contactPhone;

    private Integer deptCount;

    private String status;

    private String statusName;

    private List<DepartmentVO> children;

    private LocalDateTime createTime;
}