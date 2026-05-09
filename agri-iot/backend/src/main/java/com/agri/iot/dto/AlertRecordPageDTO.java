package com.agri.iot.dto;

import com.agri.common.vo.PageVO;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
public class AlertRecordPageDTO extends PageVO {

    private String alertNo;

    private String ruleName;

    private Long deviceId;

    private String deviceCode;

    private Long plotId;

    private Integer alertLevel;

    private Integer handleStatus;

    private LocalDateTime startTime;

    private LocalDateTime endTime;
}