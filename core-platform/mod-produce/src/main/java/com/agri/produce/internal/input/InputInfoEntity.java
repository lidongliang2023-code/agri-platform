package com.agri.produce.internal.input;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 投入品档案（种子/肥料/农药/饲料/兽药）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_input_info")
public class InputInfoEntity extends ProduceBaseEntity {

    @TableId(value = "input_id", type = IdType.INPUT)
    private String inputId;

    /** 投入品编码（租户内唯一） */
    private String inputCode;

    /** 投入品名称 */
    private String inputName;

    /** 类型 SEED/FERTILIZER/PESTICIDE/FEED/VET */
    private String inputType;

    /** 规格 */
    private String spec;

    /** 计量单位 */
    private String unit;

    /** 生产厂家 */
    private String manufacturer;

    /** 登记证号 */
    private String registrationNo;

    /** 安全间隔期（天） */
    private Integer safetyInterval;

    /** 当前库存 */
    private BigDecimal stockQty;

    /** 库存预警阈值 */
    private BigDecimal warnQty;

    /** 默认供应商ID */
    private String supplierId;

    /** 状态 1启用 0停用 */
    private Integer status;

    /**
     * 最近批次效期（yyyy-MM-dd），<b>非数据库列</b>，由 {@code InputInfoService} 冗余计算后随列表/详情返回。
     *
     * <p>效期本身是批次维度字段（挂在 {@code prod_input_stock_flow.expire_date}），
     * 投入品实体上没有。前端据此判定「临期」，避免逐项拉流水造成 N+1 请求。</p>
     */
    @TableField(exist = false)
    private LocalDate nearestExpireDate;
}
