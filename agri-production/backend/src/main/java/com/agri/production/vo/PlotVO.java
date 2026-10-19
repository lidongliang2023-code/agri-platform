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

    /** 种植类型：1 露天 2 大棚 3 水田 4 山地（存量行可能为 NULL，页面显示「—」） */
    private Integer plantingType;

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

    /**
     * 地块状态，**页面口径的数值码**：0 已停用 / 1 空闲 / 2 在种 / 3 采收期 / 4 休耕。

     *
     * <p>⚠️ 别直接序列化库里的文本：{@code agri_prod_plot_info.status} 存的是 {@code active / inactive}
     * （只表示"启用 / 停用"），而页面通篇按数字读 ——
     * {@code PLOT_STATUS_META[status]} 取标签、状态筛选按数字比较、卡片视图按数字上色。
     * 直接给文本的结果就是**列表 / 卡片 / 详情三处状态全显示"未知"**（2026-10-16 实测）。</p>

     *
     * <p>空闲 / 在种的区分**不是**地块自带的：地块表只有启用与否，
     * "在种"要由计划台账来定 —— 该地块上是否存在 {@code plan_status = 'active'}（进行中 / 在种）的计划，
     * 见 {@link #of(com.agri.production.entity.Plot, java.util.Set)}。</p>

     *
     * <p>3 采收期 / 4 休耕**目前没有数据源**（没有"是否处于采收期""是否休耕"的字段或台账），
     * 所以本服务不会返回这两个码 —— 不猜。页面这两个筛选项因此筛不出数据，属已知口径。</p>
     */
    private Integer status;

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

    /**
     * 由实体构造出参。

     *
     * @param plot 地块实体（可为 null）
     * @param plantingPlotIds **有在种计划**的地块主键集合（见 {@link #status} 的说明；可为 null）
     * @returns 出参对象（入参为 null 时返回 null）
     */
    public static PlotVO of(com.agri.production.entity.Plot plot, java.util.Set<Long> plantingPlotIds) {
        PlotVO vo = com.agri.production.common.util.BeanCopyUtils.copy(plot, PlotVO.class);
        if (vo == null) {
            return null;
        }
        vo.setStatus(statusCode(plot, plantingPlotIds));
        return vo;
    }

    /**
     * 批量构造出参，语义同 {@link #of}.
     *
     * @param plots 地块实体列表（可为 null / 空）
     * @param plantingPlotIds 有在种计划的地块主键集合（可为 null）
     * @returns 出参列表（入参为 null 时返回空列表，与 {@code BeanCopyUtils.copyList} 口径一致）
     */
    public static java.util.List<PlotVO> listOf(java.util.List<com.agri.production.entity.Plot> plots,
                                                java.util.Set<Long> plantingPlotIds) {
        return plots == null ? java.util.List.of() : plots.stream().map(plot -> of(plot, plantingPlotIds)).toList();
    }

    /**
     * 库内文本 + 是否有在种计划 → 页面口径的状态码。

     *
     * @param plot 地块实体
     * @param plantingPlotIds 有在种计划的地块主键集合
     * @returns 0 已停用 / 1 空闲 / 2 在种
     */
    private static Integer statusCode(com.agri.production.entity.Plot plot, java.util.Set<Long> plantingPlotIds) {
        String text = plot.getStatus();
        // 非 active（inactive / 空 / 其它）一律按"已停用"：地块表只有启用与否这一层语义
        if (text == null || !"active".equalsIgnoreCase(text.trim())) {
            return 0;
        }
        boolean planting = plantingPlotIds != null
                && plot.getId() != null
                && plantingPlotIds.contains(plot.getId());
        return planting ? 2 : 1;
    }
}
