package com.agri.production.vo;

import com.agri.production.entity.FoodSafetyStandardLibrary;
import lombok.Data;

/**
 * 行业标准下拉项。
 *
 * <p>字段名就是 antd Select 的形状（{@code value}/{@code label}），不是实体原名 ——
 * 页面 `options={standards}` 直接用，叫 standardNo 的话下拉会是**一列空白**：
 * value 取不到值时 antd 既不报错也不显示。</p>
 */
@Data
public class AdminFsStandardOptionVO {

    /** 标准编号 */
    private String value;
    /** 标准全称 */
    private String label;
    /** 发布机构 */
    private String issuer;

    public static AdminFsStandardOptionVO of(FoodSafetyStandardLibrary entity) {
        if (entity == null) {
            return null;
        }
        AdminFsStandardOptionVO vo = new AdminFsStandardOptionVO();
        vo.value = entity.getStandardNo();
        vo.label = entity.getStandardName();
        vo.issuer = entity.getIssuer();
        return vo;
    }
}
