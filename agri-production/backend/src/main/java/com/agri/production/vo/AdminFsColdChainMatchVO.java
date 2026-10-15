package com.agri.production.vo;

import com.agri.production.entity.FoodSafetyColdChainMatch;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 冷链撮合记录出参（页面 {@code MatchRecord}）。
 *
 * <p>映射：{@code match_id→id}、{@code supplier_name→supplier}、
 * {@code resource_type_label→resourceType}、{@code match_time→time}。</p>
 *
 * <p>{@code time} 刻意只给 {@code MM-DD}：这一列在页面上宽 110px、标题就是「时间」，
 * 原型与前端示例数据都是 07-14 这种写法。给完整 datetime 会被表格截断成一串省略号。</p>
 */
@Data
public class AdminFsColdChainMatchVO {

    private static final DateTimeFormatter MONTH_DAY = DateTimeFormatter.ofPattern("MM-dd");

    private String id;
    private String demander;
    private String supplier;
    /** 冷链车 / 冷库 */
    private String resourceType;
    /** MM-DD */
    private String time;
    /** processing / done / queued */
    private String status;
    private String cargo;
    private String tempRequire;
    /** 备注（页面直接显示，null 渲染为空白） */
    private String remark;

    public static AdminFsColdChainMatchVO of(FoodSafetyColdChainMatch entity) {
        if (entity == null) {
            return null;
        }
        AdminFsColdChainMatchVO vo = new AdminFsColdChainMatchVO();
        vo.id = entity.getMatchId();
        vo.demander = entity.getDemander();
        vo.supplier = entity.getSupplierName();
        vo.resourceType = entity.getResourceTypeLabel();
        vo.time = entity.getMatchTime() == null ? null : MONTH_DAY.format(entity.getMatchTime());
        vo.status = entity.getMatchStatus();
        vo.cargo = entity.getCargo();
        vo.tempRequire = entity.getTempRequire();
        vo.remark = entity.getRemark();
        return vo;
    }
}
