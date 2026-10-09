package com.agri.produce.internal.plot;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * 地块/棚（生产底册）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_plot")
public class PlotEntity extends BaseEntity {

    private String code;
    private String name;
    private BigDecimal areaMu;
    private String location;
    /** 1=在用 0=停用 */
    private Integer status;
}
