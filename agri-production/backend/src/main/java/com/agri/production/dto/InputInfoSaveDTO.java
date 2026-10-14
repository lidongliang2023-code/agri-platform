package com.agri.production.dto;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 投入品档案新增 / 编辑入参（前端 {@code api/inputs.ts} 的 {@code Partial<InputInfo>}）。
 *
 * <p>ID 类字段收成 String：前端表单里供应商、甚至投入品本身都可能来自自由输入或外部导入
 * （列表页有"导入"入口，按行解析文本），用 Long 接会在反序列化阶段直接失败，
 * 而失败信息对用户只表现为"保存不了"。能解析成数字就落 ID 列，否则忽略。</p>
 */
@Data
public class InputInfoSaveDTO {

    private String inputId;
    private String inputCode;
    private String inputName;

    /** SEED / FERTILIZER / PESTICIDE / FEED / VET / OTHER */
    private String inputType;

    private String spec;
    private String unit;
    private String manufacturer;
    private String registrationNo;
    private Integer safetyInterval;

    /** 当前库存（新增时可给期初库存；之后的增减一律走流水） */
    private BigDecimal stockQty;

    /** 库存预警阈值 */
    private BigDecimal warnQty;

    private String supplierId;

    /** 1 启用 / 0 停用 */
    private Integer status;

    private String remark;
}
