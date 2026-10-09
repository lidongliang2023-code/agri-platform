package com.agri.produce.internal.input;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 投入品档案（种子/肥料/农药/饲料/兽药） 数据访问。
 */
@Mapper
public interface InputInfoMapper extends BaseMapper<InputInfoEntity> {
}
