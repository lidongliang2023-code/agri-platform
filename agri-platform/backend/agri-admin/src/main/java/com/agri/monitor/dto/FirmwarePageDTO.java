package com.agri.monitor.dto;

import lombok.Data;

@Data
public class FirmwarePageDTO {
    private Integer pageNum = 1;
    private Integer pageSize = 10;
    private String firmwareCode;
    private String firmwareName;
    private String deviceType;
    private Integer isActive;
}
