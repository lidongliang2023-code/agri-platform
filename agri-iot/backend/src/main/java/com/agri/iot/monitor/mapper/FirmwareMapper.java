package com.agri.monitor.mapper;

import com.agri.monitor.entity.Firmware;
import com.agri.monitor.dto.FirmwareVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

public interface FirmwareMapper extends BaseMapper<Firmware> {
    IPage<FirmwareVO> selectPageList(Page<?> page, @Param("dto") FirmwareVO dto);
    FirmwareVO selectDetailById(@Param("id") Long id);
}
