package com.agri.produce.internal.analytics;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 分析指标快照（产量/成本/达标率，T+1 汇聚） 数据访问。
 */
@Mapper
public interface AnalyticsSnapshotMapper extends BaseMapper<AnalyticsSnapshotEntity> {
}
