package com.agri.monitor.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class FirmwareVO {
    private Long id;
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
    private Integer downloadCount;
    private String remark;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
