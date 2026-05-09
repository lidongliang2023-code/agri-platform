package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserIdentitySaveDTO {

    @NotBlank(message = "身份类型不能为空")
    private String identityType;

    private String identityName;

    private String identityData;
}