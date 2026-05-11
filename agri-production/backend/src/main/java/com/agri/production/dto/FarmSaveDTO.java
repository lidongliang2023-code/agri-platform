package com.agri.production.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class FarmSaveDTO {

    private Long id;

    @NotBlank(message = "农场名称不能为空")
    private String farmName;

    private String farmType;

    private String legalPerson;

    private String contactPhone;

    private String province;

    private String city;

    private String district;

    private String address;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private BigDecimal totalArea;

    private String farmTypeDetail;

    private String mainProducts;

    private String certifications;

    private java.time.LocalDate certificationExpireDate;

    private String certificationsJson;

    private String logoUrl;

    private String intro;

    private java.time.LocalDate registerDate;

    private String remark;
}