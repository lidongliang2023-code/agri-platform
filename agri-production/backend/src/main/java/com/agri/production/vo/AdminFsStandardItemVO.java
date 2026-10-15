package com.agri.production.vo;

import com.agri.production.entity.FoodSafetyStandardItem;
import lombok.Data;

/**
 * 标准校验项出参（页面 {@code StandardCheckItem}）。
 *
 * <p>映射：{@code item_id→id}、{@code check_result→result}。明细没有出参格式化需求
 * （页面只展示限值/实测值两段文案），照原样透出。</p>
 */
@Data
public class AdminFsStandardItemVO {

    private String id;
    private String standardNo;
    private String itemName;
    private String limitValue;
    private String measuredValue;
    /** pass / fail */
    private String result;
    private String batchNo;

    public static AdminFsStandardItemVO of(FoodSafetyStandardItem entity) {
        if (entity == null) {
            return null;
        }
        AdminFsStandardItemVO vo = new AdminFsStandardItemVO();
        vo.id = entity.getItemId();
        vo.standardNo = entity.getStandardNo();
        vo.itemName = entity.getItemName();
        vo.limitValue = entity.getLimitValue();
        vo.measuredValue = entity.getMeasuredValue();
        vo.result = entity.getCheckResult();
        vo.batchNo = entity.getBatchNo();
        return vo;
    }
}
