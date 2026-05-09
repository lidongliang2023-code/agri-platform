package com.agri.iot.dto;

import com.agri.common.vo.PageVO;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class DeviceTypePageDTO extends PageVO {

    private String typeCode;

    private String typeName;

    private String typeCategory;

    private Integer status;
}