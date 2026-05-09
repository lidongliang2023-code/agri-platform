
package com.agri.iot.dto;

import lombok.Data;

import java.util.List;

@Data
public class DeviceGroupUpdateDTO {

    private String groupName;

    private String groupIcon;

    private String groupColor;

    private String description;

    private List<Long> deviceIds;

    private Boolean allowView;

    private Boolean allowControl;
}
