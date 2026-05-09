package com.agri.monitor.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class OtaTaskVO {
    private Long id;
    private String taskCode;
    private String taskName;
    private Long firmwareId;
    private String firmwareName;
    private String firmwareVersion;
    private Integer taskType;
    private String targetDevices;
    private Integer taskStatus;
    private Integer totalDevices;
    private Integer successDevices;
    private Integer failDevices;
    private String scheduleTime;
    private String remark;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
    private String creator;
}
