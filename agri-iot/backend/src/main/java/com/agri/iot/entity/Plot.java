package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_plot")
public class Plot extends BaseEntity {

    private String plotCode;

    private String plotName;

    private String plotType;

    private BigDecimal area;

    private BigDecimal locationLat;

    private BigDecimal locationLng;

    private String locationName;

    private String cropType;

    private String cropStage;

    private Integer deviceCount;

    private Integer onlineDeviceCount;

    private Integer status;

    private Integer delFlag;
}