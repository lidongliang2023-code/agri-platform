package com.agri.production.vo;

import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.entity.PlotCrop;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** 地块种养品种出参（页面 {@code PlotCrop}）。 */
@Data
public class PlotCropVO {

    private Long id;

    /** 页面口径主键（字符串）—— 详情页按它编辑 / 删除 */
    public String getCropRecordId() {
        return id == null ? null : String.valueOf(id);
    }

    private Long plotId;

    private Long cropId;

    private String cropName;

    private String cropVariety;

    /** ORGANIC / GREEN / NORMAL */
    private String plantingStandard;

    /** TRANSPLANT / DIRECT */
    private String plantingMethod;

    /** MANUAL / MECHANICAL */
    private String operationMethod;

    private LocalDate transplantDate;

    private LocalDate expectedHarvestDate;

    private BigDecimal expectedYieldPerMu;

    private Integer plantCount;

    private BigDecimal plantSpacing;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    /**
     * 由实体构造出参。
     *
     * @param entity 品种实体（可为 null）
     * @returns 出参对象（入参为 null 时返回 null）
     */
    public static PlotCropVO of(PlotCrop entity) {
        return BeanCopyUtils.copy(entity, PlotCropVO.class);
    }

    /**
     * 批量构造出参。
     *
     * @param list 实体列表（可为 null / 空）
     * @returns 出参列表（入参为 null 时返回空列表）
     */
    public static List<PlotCropVO> listOf(List<PlotCrop> list) {
        return list == null ? List.of() : list.stream().map(PlotCropVO::of).toList();
    }
}
