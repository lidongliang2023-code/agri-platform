package com.agri.iot.dto;

import com.agri.common.vo.PageVO;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class DevicePageDTO extends PageVO {

    private String deviceCode;

    private String deviceName;

    private String deviceType;

    private Long orgId;

    private Integer status;
}
