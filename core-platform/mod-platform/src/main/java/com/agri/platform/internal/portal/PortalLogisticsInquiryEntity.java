package com.agri.platform.internal.portal;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/** 门户物流服务询价单。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_logistics_inquiry")
public class PortalLogisticsInquiryEntity extends BaseEntity {

    private String inquiryNo;
    private Long userId;
    private String origin;
    private String originDetail;
    private String destination;
    private String destinationDetail;
    private String cargoType;
    private BigDecimal weight;
    private String unit;
    private String truckType;
    private String expectedDate;
    private String expectedTime;
    private String status;
}
