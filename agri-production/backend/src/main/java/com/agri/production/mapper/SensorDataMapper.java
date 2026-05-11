package com.agri.production.mapper;

import com.agri.production.entity.SensorData;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface SensorDataMapper extends BaseMapper<SensorData> {

    List<SensorData> selectByDeviceId(@Param("deviceId") Long deviceId, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    List<Map<String, Object>> getLatestByDevice(@Param("deviceIds") List<Long> deviceIds);

    List<Map<String, Object>> getHourlyAverage(@Param("deviceId") Long deviceId, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    Map<String, Object> getStatistics(@Param("deviceId") Long deviceId, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);
}