package com.agri.produce.internal.ai;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * AI 诊断记录（病虫害/长势/成熟度识别） 数据访问。
 */
@Mapper
public interface AiDiagnosisMapper extends BaseMapper<AiDiagnosisEntity> {
}
