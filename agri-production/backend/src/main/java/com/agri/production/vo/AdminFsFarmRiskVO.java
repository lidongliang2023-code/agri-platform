package com.agri.production.vo;

import com.agri.production.entity.FarmRisk;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 农场食品安全风险出参（页面 {@code FarmRiskItem}：farmId / farmName / score）。
 *
 * <p>只出这三个字段：页面按它们渲染 16 格热力图（按分数降序取前若干条）。
 * 风险编号与统计日期是内部口径，页面不读，就不往外发。</p>
 */
@Data
public class AdminFsFarmRiskVO {

    private String farmId;
    private String farmName;
    private BigDecimal score;

    public static AdminFsFarmRiskVO of(FarmRisk entity) {
        if (entity == null) {
            return null;
        }
        AdminFsFarmRiskVO vo = new AdminFsFarmRiskVO();
        vo.farmId = entity.getFarmId();
        vo.farmName = entity.getFarmName();
        vo.score = entity.getScore();
        return vo;
    }
}
