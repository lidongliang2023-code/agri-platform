package com.agri.produce.internal.blockchain;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 区块链存证记录（溯源关键数据锚定） 数据访问。
 */
@Mapper
public interface BlockchainRecordMapper extends BaseMapper<BlockchainRecordEntity> {
}
