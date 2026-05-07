package com.agri.monitor.mapper;

import com.agri.monitor.entity.OtaTask;
import com.agri.monitor.dto.OtaTaskVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Param;

public interface OtaTaskMapper extends BaseMapper<OtaTask> {
    IPage<OtaTaskVO> selectPageList(Page<?> page, @Param("dto") OtaTaskVO dto);
    OtaTaskVO selectDetailById(@Param("id") Long id);
}
