package com.agri.produce.internal.task;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 农事任务执行记录（支持离线回传）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_task_record")
public class TaskRecordEntity extends ProduceBaseEntity {

    @TableId(value = "record_id", type = IdType.INPUT)
    private String recordId;

    /** 任务ID */
    private String taskId;

    /** 执行人 */
    private String executorId;

    /** 执行时间 */
    private LocalDateTime executeTime;

    /** 记录类型 1开始 2过程 3完成 */
    private Integer executeType;

    /** 现场照片（JSON 数组） */
    private String photos;

    /** 执行纬度 */
    private BigDecimal gpsLat;

    /** 执行经度 */
    private BigDecimal gpsLng;

    /** 与地块中心距离（米） */
    private BigDecimal gpsDistance;

    /** 异常说明 */
    private String abnormalDesc;

    /** 离线回传 0否 1是 */
    private Integer offlineFlag;
}
