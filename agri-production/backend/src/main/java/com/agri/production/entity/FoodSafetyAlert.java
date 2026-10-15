package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 食品安全告警。
 *
 * <p>主键用平台的**业务编号** {@code alert_id}（前端契约里的 id 就是它），不再套一层自增主键 ——
 * 这批 fs_* 表在平台侧就是这么设计的，多一层映射只多一处出错机会。</p>
 */
@Data
@TableName("agri_prod_fs_alert")
public class FoodSafetyAlert {

    @TableId(value = "alert_id", type = IdType.INPUT)
    private String alertId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("alert_type")
    private String alertType;

    /** 告警对象（农场名称） */
    @TableField("target_name")
    private String targetName;

    /** 关联编号，如 #A123 */
    @TableField("relate_code")
    private String relateCode;

    @TableField("happen_time")
    private LocalDateTime happenTime;

    /** urgent 紧急 / important 重要 / normal 一般 */
    @TableField("level")
    private String level;

    /** 待处理 / 处理中 / 已处理 */
    @TableField("status")
    private String status;

    /** 处置措施 */
    @TableField("measure")
    private String measure;

    /** 处置说明（与处置措施分开存） */
    @TableField("handle_remark")
    private String handleRemark;

    @TableField("handle_by")
    private Long handleBy;

    @TableField("handle_time")
    private LocalDateTime handleTime;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
