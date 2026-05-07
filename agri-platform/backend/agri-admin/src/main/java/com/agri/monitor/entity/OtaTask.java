package com.agri.monitor.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ota_task")
public class OtaTask {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String taskCode;

    private String taskName;

    private Long firmwareId;

    private Integer taskType;

    private String targetDevices;

    private Integer taskStatus;

    private Integer totalDevices;

    private Integer successDevices;

    private Integer failDevices;

    private String scheduleTime;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableField(fill = FieldFill.INSERT)
    private String creator;

    @TableLogic
    private Integer deleted;
}
