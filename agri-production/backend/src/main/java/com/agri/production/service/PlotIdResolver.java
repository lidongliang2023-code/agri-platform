package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Plot;
import com.agri.production.mapper.PlotMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 地块标识 → 本服务地块主键（与 {@link FarmIdResolver} 同法）。
 *
 * <p>页面传回的地块标识可能是本地数字主键、地块编码（P001），或平台侧标识（DEMO-PLOT-xxx，
 * 靠 {@code agri_prod_plot_info.platform_plot_id} 换算）—— 三种都认；
 * **认不出来一律 404，绝不返回 null 把筛选悄悄丢掉**（本项目踩过最多次的就是这类静默失效）。</p>
 */
@Slf4j
@Service
public class PlotIdResolver {

    private final PlotMapper plotMapper;

    public PlotIdResolver(PlotMapper plotMapper) {
        this.plotMapper = plotMapper;
    }

    /**
     * @param rawPlotId 页面传来的原值
     * @param tenantId  当前租户
     * @return 本地地块主键
     * @throws BusinessException 传了值但换算不出来（404）
     */
    public Long require(String rawPlotId, String tenantId) {
        if (rawPlotId == null || rawPlotId.isBlank()) {
            throw new BusinessException(400, "缺少地块标识");
        }
        String text = rawPlotId.trim();
        if (text.chars().allMatch(Character::isDigit)) {
            try {
                return Long.valueOf(text);
            } catch (NumberFormatException e) {
                // 超长数字：继续按编码/平台标识查
            }
        }
        Plot plot = plotMapper.selectOne(new LambdaQueryWrapper<Plot>()
                .eq(Plot::getTenantId, tenantId)
                .and(w -> w.eq(Plot::getPlotCode, text).or().eq(Plot::getPlatformPlotId, text))
                .last("LIMIT 1"));
        if (plot == null) {
            throw new BusinessException(404, "地块不存在：" + text
                    + "（本服务接受地块数字 id、地块编码，或平台侧 plot_id 如 DEMO-PLOT-001）");
        }
        return plot.getId();
    }
}
