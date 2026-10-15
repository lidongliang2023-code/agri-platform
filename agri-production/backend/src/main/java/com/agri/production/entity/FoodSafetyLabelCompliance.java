package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 食品安全-产品标签合规（P17 Tab2）。
 *
 * <p>主键是标签编号 {@code label_id}。表里同时有「校验结果」({@code check_result}) 与
 * 「标识合规性」({@code marking_result}) 两个维度：前者是必填字段齐不齐，
 * 后者是标识本身（有机/绿色/地理标志）合不合规 —— 两者不同步，不能互相推导。
 */
@Data
@TableName("agri_prod_fs_label_compliance")
public class FoodSafetyLabelCompliance {

    @TableId(value = "label_id", type = IdType.INPUT)
    private String labelId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("product_name")
    private String productName;

    @TableField("producer")
    private String producer;

    @TableField("label_version")
    private String labelVersion;

    /** 必填字段总数（GB 7718 口径为 10） */
    @TableField("required_fields")
    private Integer requiredFields;

    @TableField("filled_fields")
    private Integer filledFields;

    /** 缺失字段（顿号分隔），无缺失为 NULL */
    @TableField("missing_fields")
    private String missingFields;

    /** compliant / violation */
    @TableField("marking_result")
    private String markingResult;

    @TableField("marking_note")
    private String markingNote;

    /** pass / fail */
    @TableField("check_result")
    private String checkResult;

    @TableField("checked_at")
    private LocalDateTime checkedAt;

    /** none / notified / done */
    @TableField("rectify_status")
    private String rectifyStatus;

    @TableField("rectify_deadline")
    private String rectifyDeadline;

    @TableField("rectify_remark")
    private String rectifyRemark;

    @TableField("rectify_time")
    private LocalDateTime rectifyTime;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
