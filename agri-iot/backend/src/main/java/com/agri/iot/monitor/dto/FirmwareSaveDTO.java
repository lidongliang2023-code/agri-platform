package com.agri.monitor.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class FirmwareSaveDTO {
    private String firmwareCode;
    private String firmwareName;
    private String deviceType;
    private String version;
    private String manufacturer;
    private String filePath;
    private String fileSize;
    private String checkSum;
    private BigDecimal fileVersion;
    private String upgradeDesc;
    private Integer isForce;
    private Integer isActive;
    private String remark;
}
