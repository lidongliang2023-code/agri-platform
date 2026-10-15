package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_task_info")
public class Task extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("task_code")
    private String taskCode;

    @TableField("task_name")
    private String taskName;

    @TableField("task_type")
    private String taskType;

    @TableField("task_type_detail")
    private String taskTypeDetail;

    @TableField("farm_id")
    private Long farmId;

    @TableField("farm_code")
    private String farmCode;

    @TableField("plot_id")
    private Long plotId;

    @TableField("plot_code")
    private String plotCode;

    @TableField("crop_name")
    private String cropName;

    @TableField("task_desc")
    private String taskDesc;

    @TableField("executor_id")
    private Long executorId;

    @TableField("executor_name")
    private String executorName;

    /** 累计催办次数（运营端监控页催办时递增；列见 schema-patch-monitor-page.sql） */
    @TableField("urge_count")
    private Integer urgeCount;

    /** 最近一次催办时间 */
    @TableField("last_urge_time")
    private java.time.LocalDateTime lastUrgeTime;

    /** 最近一次催办人 */
    @TableField("last_urge_by")
    private String lastUrgeBy;

    @TableField("plan_start_time")
    private java.time.LocalDateTime planStartTime;

    @TableField("plan_end_time")
    private java.time.LocalDateTime planEndTime;

    @TableField("actual_start_time")
    private java.time.LocalDateTime actualStartTime;

    @TableField("actual_end_time")
    private java.time.LocalDateTime actualEndTime;

    @TableField("status")
    private String status;

    @TableField("priority")
    private String priority;

    @TableField("input_materials")
    private String inputMaterials;

    @TableField("input_materials_json")
    private String inputMaterialsJson;

    @TableField("expected_output")
    private BigDecimal expectedOutput;

    @TableField("actual_output")
    private BigDecimal actualOutput;

    @TableField("quality_requirement")
    private String qualityRequirement;

    @TableField("result_photo_urls")
    private String resultPhotoUrls;

    @TableField("result_desc")
    private String resultDesc;

    /*
     * 原先这里还有 approval_status / approval_comment 两个字段：表里从来没有这两列，
     * 而 MyBatis-Plus 生成的 SELECT 会把它们带上 —— 一查任务就是
     * Unknown column 'approval_status' in 'field list'（任务接口整片 500，实测踩到）。
     * 按"以接口为准"的口径换成下面的 accept_*（前端读的就是那一组）。
     */

    @TableField("template_id")
    private Long templateId;

    /**
     * 派发人 / 验收（前端「农事任务」页契约里的 assignerId / assignerName /
     * acceptStatus / acceptRemark / rejectCount）。
     *
     * <p>原先实体上叫 approval_status / approval_comment —— 既不在表里、前端也不认这两个名字
     * （页面读的是 acceptStatus / acceptRemark）。按"以接口为准"的口径换成这两个，
     * 并补上派发人与驳回次数。</p>
     */
    @TableField("assigner_id")
    private Long assignerId;
    @TableField("assigner_name")
    private String assignerName;
    /** 0 待验收 1 通过 2 驳回 */
    @TableField("accept_status")
    private Integer acceptStatus;
    @TableField("accept_remark")
    private String acceptRemark;
    @TableField("reject_count")
    private Integer rejectCount;
    @TableField("acceptor_id")
    private Long acceptorId;
    @TableField("acceptor_name")
    private String acceptorName;
    @TableField("accepted_at")
    private java.time.LocalDateTime acceptedAt;

    @TableField("remark")
    private String remark;
}
