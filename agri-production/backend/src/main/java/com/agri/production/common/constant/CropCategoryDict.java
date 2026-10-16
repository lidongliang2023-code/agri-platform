package com.agri.production.common.constant;

import java.util.List;

/**
 * 作物类别：**受控取值**的唯一出处。

 *
 * <p>此前 {@code crop_category} 是自由文本，页面上只给了一串前端硬编码的提示值 ——
 * 后端不校验，于是"蔬菜""蔬菜类""叶菜"能同时进库，类别统计立刻失去意义。</p>

 *
 * <p>口径：</p>
 * <ul>
 *   <li>取值就是**中文类别名本身**（与作物名同法：可读、可直接显示，库里也是文本列）；</li>
 *   <li>**可空** —— 拿不准就留空，不硬塞一个类别；</li>
 *   <li>写入时校验：非空必须是下面这几个之一，否则 400 并给出可选范围（错误信息里带上可选值，
 *       免得用户去翻文档）；</li>
 *   <li>取值列表通过 {@code GET /crops/categories} 出给页面，前端不再自己抄一份 ——
 *       抄两份就是下一次"两边不一致"。</li>
 * </ul>
 *
 * <p>「其他」是**为闭合枚举留的兜底项**：没有它，"食用菌"这类作物只能留空，类别字段就废了一半。
 * 若产品不认可这个兜底项，去掉它、或替换成正式类别即可（只改本文件与页面选项）。</p>
 */
public final class CropCategoryDict {

    /** 受控取值（顺序即页面展示顺序） */
    private static final List<String> VALUES = List.of(
            "粮食作物",
            "蔬菜",
            "果树",
            "经济作物",
            "饲料作物",
            "花卉",
            "其他");

    private CropCategoryDict() {
    }

    /**
     * 全部可选类别。
     *
     * @returns 不可变列表（顺序即展示顺序）
     */
    public static List<String> values() {
        return VALUES;
    }

    /**
     * 归一化 + 校验。
     *
     * @param raw 前端下发的原值（可为 null / 空串 / 带空格）
     * @returns 归一化后的取值；null 表示"不设置类别"
     * @throws IllegalArgumentException 传了值但不在受控取值里（调用方包成 400）
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String text = raw.trim();
        if (text.isEmpty()) {
            return null;
        }
        if (!VALUES.contains(text)) {
            throw new IllegalArgumentException("作物类别不在可选范围内：" + text + "（可选：" + String.join("/", VALUES) + "）");
        }
        return text;
    }
}
