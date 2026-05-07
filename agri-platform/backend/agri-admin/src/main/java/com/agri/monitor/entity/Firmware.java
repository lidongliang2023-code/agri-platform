package com.agri.monitor.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("firmware")
public class Firmware {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String firmwareCode;

    private String firmwareName;

    private String deviceType;

    private String version;

    private String manufacturer;

    private String filePath;

    private String fileSize;

    private String checkSum;

    private BigDecimal fileVersion;

    private String upgradeDesc;

    private Integer isForce;

    private Integer isActive;

    private Integer downloadCount;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
