package com.agri.production.mapper;

import com.agri.production.entity.IoTDevice;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface IoTDeviceMapper extends BaseMapper<IoTDevice> {

    IPage<IoTDevice> pageQuery(Page<IoTDevice> page, @Param("deviceName") String deviceName, @Param("deviceType") String deviceType, @Param("status") String status, @Param("tenantId") String tenantId);

    long countByStatus(@Param("status") String status, @Param("tenantId") String tenantId);
}