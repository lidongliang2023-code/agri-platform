package com.agri.monitor.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("gateway")
public class Gateway {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String gatewayCode;

    private String gatewayName;

    private String manufacturer;

    private String model;

    private String firmwareVersion;

    private String ipAddress;

    private Integer port;

    private String protocol;

    private Integer plotId;

    private Integer onlineStatus;

    private Integer heartInterval;

    private String location;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
