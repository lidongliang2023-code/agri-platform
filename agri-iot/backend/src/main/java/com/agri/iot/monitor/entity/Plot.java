package com.agri.monitor.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("plot")
public class Plot {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String plotCode;

    private String plotName;

    private BigDecimal area;

    private String cropType;

    private Integer status;

    private String location;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private String soilType;

    private String irrigationType;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
