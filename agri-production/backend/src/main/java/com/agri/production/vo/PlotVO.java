package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PlotVO {

    private Long id;

    private String plotCode;

    private String plotName;

    private Long farmId;

    private String farmCode;

    private String farmName;

    private BigDecimal area;

    private String shape;

    private String boundary;

    private BigDecimal centerLongitude;

    private BigDecimal centerLatitude;

    private String soilType;

    /** 作物品种（页面 cropVariety）：地块列表"作物"列的数据来源，实体同名属性由 BeanCopyUtils 自动带过来。 */
    private String cropVariety;

    /** 灌溉方式（页面 irrigationType）。 */
    private String irrigationType;

    private BigDecimal soilPh;

    private BigDecimal soilOrganicMatter;

    private String currentCrop;

    /**
     * 当前作物的主数据主键（页面作物下拉回显用）。

     *
     * <p>与 {@code currentCrop}（名称）成对：页面下拉的 value 是主键、label 是名称。
     * 历史行可能只有 {@code currentCrop} 没有 ID（作物做主数据之前登记的），此时为 null。</p>
     */
    private Long cropId;

    private LocalDate plantingDate;

    private LocalDate expectedHarvestDate;

    private String status;

    private String remark;

    private String tenantId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    /**
     * 页面口径的地块主键（字符串）。

     *
     * <p>页面列表直接读 {@code record.plotId}（没有 normalize 层），而本 VO 的主键字段叫 {@code id} ——
     * 切 /plots 段之前必须给出这个别名，否则页面上"行 id 是 undefined、点详情跳到 /undefined"，
     * 而接口全是 200（iot 设备段踩过同一个坑）。用只读派生 getter 实现：不需要在构建处逐字段赋值，
     * 也就不会出现"两个字段各自维护、某一处忘了同步"的情况。</p>
     */
    public String getPlotId() {
        return id == null ? null : String.valueOf(id);
    }
}
