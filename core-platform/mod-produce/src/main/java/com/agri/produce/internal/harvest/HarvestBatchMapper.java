package com.agri.produce.internal.harvest;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 采收批次（溯源主链：地块 → 采收 → 检测 → 批次 → 溯源码） 数据访问。
 */
@Mapper
public interface HarvestBatchMapper extends BaseMapper<HarvestBatchEntity> {
}
