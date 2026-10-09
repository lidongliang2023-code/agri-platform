package com.agri.produce.internal.plot;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * V1 存量地块表 prod_plot（雪花 Long 主键）的 Mapper。
 *
 * <p><b>遗留表（待专项迁移处理）：</b>本轮起所有地块接口已迁至
 * {@code prod_plot_info}（varchar(32) 业务主键 plotId，符合 PRD 11.2）。
 * {@code prod_plot} 不再被任何 Controller / Service 引用，仅保留本 Mapper 与表结构以对齐 V1 基线。</p>
 *
 * <p><b>请勿在本 Mapper 之上新增业务接口</b>；后续如需统一，由专项迁移处理。
 * 注意：V1 为全新工程的初始化脚本，本表不含需要保全的生产数据。</p>
 */
@Mapper
public interface PlotMapper extends BaseMapper<PlotEntity> {
}
