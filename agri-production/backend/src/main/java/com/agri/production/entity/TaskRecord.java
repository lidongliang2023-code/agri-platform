package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 任务执行记录（打卡）。
 *
 * <p>前端「农事任务详情」页用它：{@code GET/POST /tasks/{taskId}/records}，
 * 记录类型 1 开始 2 过程 3 完成，带照片、GPS 与离线补传标记。</p>
 *
 * <p>字段名**直接按前端契约命名**（recordId / executeTime / gpsLat …），
 * 物理列用 {@code @TableField} 指到 snake_case —— 这样就不必再套一层 VO：
 * 出参 Java 名即 JSON 名，少一层就容易少一处对不上的地方。</p>
 */
@Data
@TableName("agri_prod_task_record")
public class TaskRecord {

    @TableId(value = "id", type = IdType.AUTO)
    private Long recordId;

    @TableField("task_id")
    private Long taskId;

    @TableField("executor_id")
    private Long executorId;

    @TableField("executor_name")
    private String executorName;

    @TableField("execute_time")
    private LocalDateTime executeTime;

    /** 1 开始 2 过程 3 完成 */
    @TableField("execute_type")
    private Integer executeType;

    /** 照片地址（JSON 数组字符串或逗号分隔，与前端约定的存法一致） */
    @TableField("photos")
    private String photos;

    @TableField("gps_lat")
    private BigDecimal gpsLat;

    @TableField("gps_lng")
    private BigDecimal gpsLng;

    /** 据地块中心的距离（米） */
    @TableField("gps_distance")
    private BigDecimal gpsDistance;

    @TableField("abnormal_desc")
    private String abnormalDesc;

    /** 0 在线 1 离线补传 */
    @TableField("offline_flag")
    private Integer offlineFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_time")
    private LocalDateTime createTime;
}
