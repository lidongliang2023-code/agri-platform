package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Position;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface PositionMapper extends BaseMapper<Position> {

    List<Position> selectByDeptId(String deptId);

    List<Position> selectByOrgId(String orgId);
}