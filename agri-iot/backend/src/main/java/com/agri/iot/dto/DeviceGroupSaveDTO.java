
package com.agri.iot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class DeviceGroupSaveDTO {

    @NotBlank(message = "分组名称不能为空")
    private String groupName;

    private String groupIcon;

    private String groupColor;

    private String description;

    private List<Long> deviceIds;

    private Boolean allowView;

    private Boolean allowControl;
}
