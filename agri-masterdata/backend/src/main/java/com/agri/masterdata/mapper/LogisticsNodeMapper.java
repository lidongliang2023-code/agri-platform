package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.LogisticsNode;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface LogisticsNodeMapper extends BaseMapper<LogisticsNode> {

    LogisticsNode selectByNodeCode(@Param("nodeCode") String nodeCode);

    List<LogisticsNode> selectByRegionCode(@Param("regionCode") String regionCode);

    List<LogisticsNode> selectByNodeType(@Param("nodeType") String nodeType);
}