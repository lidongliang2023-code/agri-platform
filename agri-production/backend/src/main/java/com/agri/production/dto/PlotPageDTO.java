package com.agri.production.dto;

import lombok.Data;

@Data
public class PlotPageDTO {

    private String plotName;

    private Long farmId;

    private String currentCrop;

    private String status;

    private Integer pageNum = 1;

    private Integer pageSize = 10;

    /**
     * 状态筛选：页面口径是**数字码**（1 启用 / 0 停用，与出参同一套），库里存的是文本 active / inactive。

     *
     * <p>换算放在 setter 里（同 {@code FarmPageDTO.setStatus}）：Spring 绑定查询参数与任何
     * {@code dto.setStatus(...)} 调用都会经过它，mapper 的 XML 不必再写一遍换算。</p>

     *
     * <p>不做换算的后果是**筛选静默失效**：传 {@code status=1} 会变成 {@code AND p.status = '1'}，
     * 而库里是 {@code active} —— 一条都筛不出来（农场那段实测过同一个坑）。</p>
     *
     * @param status 数字码 / 库内文本 / 空
     */
    public void setStatus(String status) {
        this.status = normalizeStatus(status);
    }

    /**
     * 状态入参归一。
     *
     * @param status 原始入参
     * @returns 库内文本（active / inactive）；空串返回 null（= 不过滤）；认不出的原样透传
     */
    private static String normalizeStatus(String status) {
        if (status == null) {
            return null;
        }
        String text = status.trim();
        if (text.isEmpty()) {
            return null;
        }
        if ("1".equals(text) || "active".equalsIgnoreCase(text)) {
            return "active";
        }
        if ("0".equals(text) || "inactive".equalsIgnoreCase(text)) {
            return "inactive";
        }
        return text;
    }
}
