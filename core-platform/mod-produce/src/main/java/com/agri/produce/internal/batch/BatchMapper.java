package com.agri.produce.internal.batch;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * V1 存量「农事批次」表 prod_batch 的 Mapper。
 *
 * <p><b>旧概念，存量兼容保留。</b>架构侧已裁决：批次体系的终态口径是
 * {@code prod_harvest_batch}（PRD 11.2.5 采收批次），它是采收批次的<b>权威表</b>。
 * 新生产链路（采收登记、批次生成、溯源激活、等级定价）一律使用
 * {@code prod_harvest_batch} / {@link com.agri.produce.internal.harvest.HarvestBatchEntity}。</p>
 *
 * <p>本 Mapper 仅供存量链路兼容，请勿在其上扩展新业务；后续如需统一由专项迁移处理。</p>
 */
@Mapper
public interface BatchMapper extends BaseMapper<BatchEntity> {
}
