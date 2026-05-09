package com.agri.monitor.dto;

import lombok.Data;

@Data
public class OtaTaskPageDTO {
    private Integer pageNum = 1;
    private Integer pageSize = 10;
    private String taskCode;
    private String taskName;
    private Integer taskType;
    private Integer taskStatus;
}
