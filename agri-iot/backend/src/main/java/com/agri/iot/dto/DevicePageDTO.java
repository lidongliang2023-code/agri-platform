package com.agri.iot.dto;

import com.agri.common.vo.PageVO;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class DevicePageDTO extends PageVO {

    private String deviceCode;

    private String deviceName;

    private Long deviceTypeId;

    private Long plotId;

    private Integer onlineStatus;

    private Integer status;
}
