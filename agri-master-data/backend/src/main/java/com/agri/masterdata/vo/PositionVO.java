package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class PositionVO {

    private String positionId;

    private String positionCode;

    private String positionName;

    private String deptId;

    private String deptName;

    private Integer positionLevel;

    private String positionDesc;

    private Integer incumbentCount;

    private String status;

    private String statusName;

    private LocalDateTime createTime;
}