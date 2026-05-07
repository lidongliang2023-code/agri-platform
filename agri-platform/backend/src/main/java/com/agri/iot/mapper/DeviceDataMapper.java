package com.agri.iot.mapper;

import com.agri.iot.entity.DeviceData;
import com.agri.iot.vo.DeviceDataVO;
import com.agri.iot.vo.RealtimeDataVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface DeviceDataMapper extends BaseMapper<DeviceData> {

    List<DeviceDataVO> selectHistoryData(
            @Param("deviceId") Long deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("offset") Integer offset,
            @Param("limit") Integer limit
    );

    long selectHistoryCount(
            @Param("deviceId") Long deviceId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime
    );

    RealtimeDataVO selectRealtimeData(@Param("deviceId") Long deviceId);

    List<RealtimeDataVO> selectPlotRealtimeData(@Param("plotId") Long plotId);
}
