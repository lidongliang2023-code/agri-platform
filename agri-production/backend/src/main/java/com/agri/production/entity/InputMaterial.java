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
 * 投入品档案（农资台账）。
 *
 * <p>字段名**直接按前端契约命名**（{@code api/inputs.ts} 的 {@code InputInfo} / 共用的
 * {@code InputItem}），物理列用 {@code @TableField} 指到 {@code agri_prod_input_material}
 * 上已有的列 —— 与 TaskRecord / PlanStage 同一口径：出参 Java 名即 JSON 名，
 * 少一层 VO 就少一处对不上的地方。</p>
 *
 * <p><b>为什么改回 {@code agri_prod_input_material}</b>：这个实体原先映射的是
 * {@code agri_prod_input_ledger} —— 那张表从来没建过，接口一调就是 Unknown column /
 * Table doesn't exist；而库里真正存在的是 {@code agri_prod_input_material}。
 * 顺带把字段名从 materialXxx 收敛到契约的 inputXxx。</p>
 *
 * <p>刻意不继承 BaseEntity：那会固定带 farm_id，而农资档案是按主体（租户）维护的，
 * 没有 farm_id 这一列。</p>
 *
 * <p>值域：{@code inputType} = SEED / FERTILIZER / PESTICIDE / FEED / VET / OTHER；
 * {@code status} 1 启用 0 停用；{@code warnQty} 是库存预警阈值。</p>
 */
@Data
@TableName("agri_prod_input_material")
public class InputMaterial {

    @TableId(value = "id", type = IdType.AUTO)
    private Long inputId;

    @TableField("material_code")
    private String inputCode;

    @TableField("material_name")
    private String inputName;

    @TableField("material_type")
    private String inputType;

    @TableField("specification")
    private String spec;

    @TableField("unit")
    private String unit;

    @TableField("manufacturer")
    private String manufacturer;

    @TableField("registration_no")
    private String registrationNo;

    /** 安全间隔期（天） */
    @TableField("safety_interval")
    private Integer safetyInterval;

    /** 当前库存 */
    @TableField("stock_qty")
    private BigDecimal stockQty;

    /** 库存预警阈值（沿用表上已有的 warning_threshold 列） */
    @TableField("warning_threshold")
    private BigDecimal warnQty;

    @TableField("supplier_id")
    private Long supplierId;

    /** 1 启用 / 0 停用 */
    @TableField("status")
    private Integer status;

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

    /**
     * 最近批次效期（yyyy-MM-dd）——**不是表列**，由库存流水聚合后回填。
     *
     * <p>页面的"临期"判定要用它（{@code resolveStockState(stockQty, warnQty, nearestExpireDate)}），
     * 而效期本身挂在批次上（流水行）。后端一次聚合、随列表返回，
     * 免得前端为了判临期去逐条拉流水（N+1）。</p>
     */
    @TableField(exist = false)
    private String nearestExpireDate;
}
