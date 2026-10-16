package com.agri.production.dto;

import lombok.Data;

@Data
public class FarmPageDTO {

    private String farmName;

    private String farmType;

    private String province;

    private String city;

    private String status;

    private String auditStatus;

    private Integer pageNum = 1;

    private Integer pageSize = 10;

    /**
     * 状态筛选：页面口径是**数值码**（1 运营中 / 0 已停用），库里存的是文本 active/inactive。
     *
     * <p>换算故意放在 setter 里：Spring MVC 绑定查询参数、以及任何 {@code dto.setStatus(...)} 的调用
     * 都会经过这里，这样 mapper 的 XML 不必再写一遍换算（也不必改 SQL）。</p>

     *
     * <p>2026-10-16 实测：页面筛选器传 {@code status=1}，SQL 变成 {@code AND status = '1'}，
     * 而库里是 {@code active} —— 运营中/已停用两个筛选项都一条筛不出来（手工传 {@code active} 才有 22 条）。</p>
     *
     * @param status 数值码 / 库内文本 / 空
     */
    public void setStatus(String status) {
        this.status = normalizeStatus(status);
    }

    /**
     * 状态入参归一。
     *
     * @param status 原始入参
     * @returns 库内文本（active / inactive）；空串返回 null（= 不过滤）；
     *          认不出的值原样透传 —— 筛不出来也是如实的"没有匹配"，不替用户猜
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
