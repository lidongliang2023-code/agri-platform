package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 质量检测单。
 *
 * <p>字段名**直接按前端契约命名**（{@code @agri/shared/types/quality} 的 {@code RawInspection}），
 * 物理列用 {@code @TableField} 指到 snake_case —— 与 TaskRecord / PlanStage / InputStockFlow 同一口径。
 *
 * <p>值域与页面一致（这三套值域和旧实体那套完全不是一回事，混用就会出现"状态显示成英文原文"）：</p>
 * <ul>
 *   <li>{@code inspectionType}：SELF 自检 / SEND 送检 / SAMPLING 抽检</li>
 *   <li>{@code status}：PENDING 待检 / TESTING 检测中 / DONE 已完成</li>
 *   <li>{@code result}：PASS 合格 / FAIL 不合格</li>
 * </ul>
 *
 * <p><b>为什么不沿用 {@code agri_prod_quality_inspection}</b>：那张表的列是另一套设计
 * （inspection_code / inspect_date / inspect_items / conclusion / audit_status），
 * 与本契约要的列几乎没有交集，而旧实体映射的 15 列里有 12 列在那张表上根本不存在 ——
 * 也就是说运营端的检测单接口一直是坏的。这里按契约另建
 * {@code agri_prod_inspection}（与 core-platform 的同名表口径一致），
 * 旧表与旧实体一并下线（旧表实测 0 行，没有数据要迁）。</p>
 */
@Data
@TableName("agri_prod_inspection")
public class Inspection {

    @TableId(value = "id", type = IdType.AUTO)
    private Long inspectionId;

    @TableField("inspection_no")
    private String inspectionNo;

    @TableField("batch_id")
    private Long batchId;

    @TableField("batch_no")
    private String batchNo;

    @TableField("farm_id")
    private Long farmId;

    @TableField("plot_id")
    private Long plotId;

    @TableField("crop_id")
    private Long cropId;

    @TableField("crop_name")
    private String cropName;

    /** SELF 自检 / SEND 送检 / SAMPLING 抽检 */
    @TableField("inspection_type")
    private String inspectionType;

    @TableField("inspector_id")
    private Long inspectorId;

    @TableField("inspector_name")
    private String inspectorName;

    /** 抽样数量 */
    @TableField("sample_qty")
    private BigDecimal sampleQty;

    /** 抽样时间 */
    @TableField("sample_at")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime sampleAt;

    /** PASS 合格 / FAIL 不合格（未出结论时为 null） */
    @TableField("result")
    private String result;

    @TableField("report_url")
    private String reportUrl;

    /** PENDING 待检 / TESTING 检测中 / DONE 已完成 */
    @TableField("status")
    private String status;

    @TableField("lab_id")
    private Long labId;

    @TableField("lab_name")
    private String labName;

    /** 是否已上链：1 已上链 / 0 未上链 */
    @TableField("on_chain")
    private Integer onChain;

    @TableField("remark")
    private String remark;

    @TableField("tenant_id")
    private String tenantId;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    @JsonProperty("createdAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;

    @JsonProperty("updatedAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;
}
