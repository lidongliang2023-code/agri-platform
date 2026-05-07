package com.agri.monitor.mapper;

import com.agri.monitor.entity.Gateway;
import com.agri.monitor.dto.GatewayVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

public interface GatewayMapper extends BaseMapper<Gateway> {
    IPage<GatewayVO> selectPageList(Page<?> page, @Param("dto") GatewayVO dto);
    GatewayVO selectDetailById(@Param("id") Long id);
}
