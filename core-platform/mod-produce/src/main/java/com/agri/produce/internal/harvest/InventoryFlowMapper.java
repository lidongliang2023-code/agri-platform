package com.agri.produce.internal.harvest;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 批次库存流水（出入库/盘点/损耗） 数据访问。
 */
@Mapper
public interface InventoryFlowMapper extends BaseMapper<InventoryFlowEntity> {
}
