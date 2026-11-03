package com.agri.production.vo;

import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.entity.InputMaterial;
import com.agri.production.entity.InputStockFlow;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 投入品库存流水出参（全量流水分页用，带投入品名称 / 单位）。 */
@Data
public class InputStockFlowVO {

    private Long flowId;

    private Long inputId;

    /** 投入品名称（跨投入品查流水时直接展示，免前端再拼一次） */
    private String inputName;

    /** 计量单位（数量列展示用） */
    private String inputUnit;

    private Long warehouseId;

    /** 1 入库 2 领用 3 退回 4 盘盈 5 盘亏 6 报损 */
    private Integer flowType;

    /** 带符号数量：入库/退回/盘盈为正，领用/盘亏/报损为负 */
    private BigDecimal qty;

    private String batchNo;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate expireDate;

    private Long operatorId;

    private Long relatedTaskId;

    private String remark;

    @JsonProperty("createdAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;

    @JsonProperty("updatedAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updateTime;

    /**
     * 由流水实体构造出参。
     *
     * @param flow 流水实体
     * @param material 对应投入品档案（可为 null）
     * @returns 出参对象（入参为 null 时返回 null）
     */
    public static InputStockFlowVO of(InputStockFlow flow, InputMaterial material) {
        InputStockFlowVO vo = BeanCopyUtils.copy(flow, InputStockFlowVO.class);
        if (vo == null) {
            return null;
        }
        if (material != null) {
            vo.setInputName(material.getInputName());
            vo.setInputUnit(material.getUnit());
        }
        return vo;
    }
}
