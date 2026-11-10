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

    List<Map<String, Object>> getWarehouseLatest(@Param("tenantId") String tenantId,
            @Param("farmId") Long farmId, @Param("plotId") Long plotId);

    List<SensorData> selectByDeviceId(@Param("deviceId") Long deviceId, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime, @Param("tenantId") String tenantId);

    List<Map<String, Object>> getLatestByDevice(@Param("deviceIds") List<Long> deviceIds, @Param("tenantId") String tenantId);

    List<Map<String, Object>> getHourlyAverage(@Param("deviceId") Long deviceId, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime, @Param("tenantId") String tenantId);

    Map<String, Object> getStatistics(@Param("deviceId") Long deviceId, @Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime, @Param("tenantId") String tenantId);
}