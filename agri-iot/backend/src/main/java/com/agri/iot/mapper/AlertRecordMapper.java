package com.agri.iot.mapper;

import com.agri.iot.dto.AlertRecordPageDTO;
import com.agri.iot.entity.AlertRecord;
import com.agri.iot.vo.AlertRecordVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AlertRecordMapper extends BaseMapper<AlertRecord> {

    List<AlertRecordVO> selectPageVO(@Param("dto") AlertRecordPageDTO dto);

    long selectCount(@Param("dto") AlertRecordPageDTO dto);

    AlertRecordVO selectVOById(@Param("id") Long id);

    long selectUnhandledCount();

    List<AlertRecordVO> selectRecentAlerts(@Param("limit") Integer limit);
}