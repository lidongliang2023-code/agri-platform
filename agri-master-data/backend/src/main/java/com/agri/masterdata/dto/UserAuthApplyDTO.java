package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class UserAuthApplyDTO {

    @NotBlank(message = "认证类型不能为空")
    private String authType;

    private Map<String, Object> authData;
}