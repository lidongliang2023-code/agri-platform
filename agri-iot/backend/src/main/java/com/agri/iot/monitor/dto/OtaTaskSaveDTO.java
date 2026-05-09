package com.agri.monitor.dto;

import lombok.Data;

@Data
public class OtaTaskSaveDTO {
    private String taskCode;
    private String taskName;
    private Long firmwareId;
    private Integer taskType;
    private String targetDevices;
    private String scheduleTime;
    private String remark;
}
