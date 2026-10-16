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

    /**
     * 页面口径的字段名别名（新建/编辑表单发的是这几个名字，缺了就会被静默丢掉）。

     *
     * <p>2026-10-16 实测：表单发 {@code areaTotal / managerName / managerPhone}，而本 DTO 只认
     * {@code totalArea / legalPerson / contactPhone} —— 于是"保存成功"但详情页的面积、负责人、
     * 联系电话全是空的。这里把页面名一并接住，由服务层归一到实体列。</p>
     */
    private BigDecimal areaTotal;

    /** 页面口径：负责人姓名（落到新增的 manager_name 列）。 */
    private String managerName;

    /** 页面口径：负责人电话（归一到 contact_phone）。 */
    private String managerPhone;

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
