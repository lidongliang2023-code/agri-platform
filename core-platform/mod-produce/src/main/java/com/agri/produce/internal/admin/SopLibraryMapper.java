package com.agri.produce.internal.admin;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * SOP 标准作业规程库（按作物/阶段下发） 数据访问。
 */
@Mapper
public interface SopLibraryMapper extends BaseMapper<SopLibraryEntity> {
}
