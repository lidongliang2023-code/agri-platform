package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AlertRecordVO {

    private Long id;

    private String alertNo;

    private Long ruleId;

    private String ruleName;

    private Long deviceId;

    private String deviceCode;

    private String deviceName;

    private Long plotId;

    private String plotName;

    private Integer alertLevel;

    private String alertLevelText;

    private String propertyCode;

    private String propertyName;

    private String triggerValue;

    private String thresholdValue;

    private String alertContent;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime alertTime;

    private Integer handleStatus;

    private String handleStatusText;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime handleTime;

    private String handleUser;

    private String handleResult;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;
}