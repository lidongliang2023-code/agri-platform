package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 权限巡检结果（{@code agri_md_permission_anomaly}）。
 *
 * <p>按 {@code (rule_code, target_type, target_id)} 唯一：重复扫描只把 {@code last_seen} 推到当下，
 * 第一次发现的时间留在 {@code first_seen}。本轮没有再复现的 OPEN 记录会被置为 RESOLVED ——
 * 授权修好之后，异常不会永远挂在审计页上。</p>
 */
@Data
@TableName("agri_md_permission_anomaly")
public class PermissionAnomaly {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private String ruleCode;

    private String anomalyType;

    private String severity;

    /** USER / ROLE_MENU / USER_ROLE / ROLE_MENU_DUP */
    private String targetType;

    /** 雪花主键按字符串存，避免前端 Number 精度丢失 */
    private String targetId;

    private String targetName;

    private String tenantId;

    /** 判定依据：数字与对象名，不写"可能存在风险"这种空话 */
    private String detail;

    /** OPEN / RESOLVED */
    private String status;

    private LocalDateTime firstSeen;

    private LocalDateTime lastSeen;

    private LocalDateTime resolvedTime;

    @TableField("del_flag")
    private Integer delFlag;
}
