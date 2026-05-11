package com.agri.production.service.impl;

import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.Farm;
import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.Task;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.IoTDeviceMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.service.IProductionAdminService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ProductionAdminServiceImpl implements IProductionAdminService {

    private final FarmMapper farmMapper;
    private final TaskMapper taskMapper;
    private final AlertRecordMapper alertRecordMapper;
    private final IoTDeviceMapper ioTDeviceMapper;

    public ProductionAdminServiceImpl(FarmMapper farmMapper, TaskMapper taskMapper,
                                      AlertRecordMapper alertRecordMapper, IoTDeviceMapper ioTDeviceMapper) {
        this.farmMapper = farmMapper;
        this.taskMapper = taskMapper;
        this.alertRecordMapper = alertRecordMapper;
        this.ioTDeviceMapper = ioTDeviceMapper;
    }

    @Override
    public Map<String, Object> getAdminOverview() {
        Map<String, Object> result = new HashMap<>();
        
        result.put("farmCount", getFarmCount());
        result.put("plotCount", getPlotCount());
        result.put("taskCount", getTaskCount());
        result.put("alertCount", getAlertCount());
        result.put("traceCount", getTraceCount());
        result.put("deviceCount", getDeviceCount());
        
        return result;
    }

    @Override
    public Map<String, Object> getFarmStatistics() {
        Map<String, Object> result = new HashMap<>();
        
        LambdaQueryWrapper<Farm> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Farm::getDeleted, 0);
        
        List<Farm> farms = farmMapper.selectList(wrapper);
        
        long activeCount = farms.stream().filter(f -> "active".equals(f.getStatus())).count();
        long inactiveCount = farms.stream().filter(f -> "inactive".equals(f.getStatus())).count();
        
        result.put("total", farms.size());
        result.put("active", activeCount);
        result.put("inactive", inactiveCount);
        
        Map<String, Long> provinceDistribution = new HashMap<>();
        farms.forEach(f -> {
            String province = f.getProvince() != null ? f.getProvince() : "未知";
            provinceDistribution.merge(province, 1L, Long::sum);
        });
        result.put("provinceDistribution", provinceDistribution);
        
        return result;
    }

    @Override
    public Map<String, Object> getTaskStatistics() {
        Map<String, Object> result = new HashMap<>();
        
        LambdaQueryWrapper<Task> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Task::getDeleted, 0);
        
        List<Task> tasks = taskMapper.selectList(wrapper);
        
        long pendingCount = tasks.stream().filter(t -> "pending".equals(t.getStatus())).count();
        long inProgressCount = tasks.stream().filter(t -> "in_progress".equals(t.getStatus())).count();
        long completedCount = tasks.stream().filter(t -> "completed".equals(t.getStatus())).count();
        
        result.put("total", tasks.size());
        result.put("pending", pendingCount);
        result.put("inProgress", inProgressCount);
        result.put("completed", completedCount);
        
        return result;
    }

    @Override
    public Map<String, Object> getHarvestStatistics() {
        Map<String, Object> result = new HashMap<>();
        result.put("total", 12000);
        result.put("today", 350);
        result.put("month", 4500);
        
        Map<String, Object> chartData = new HashMap<>();
        chartData.put("labels", new String[]{"1月", "2月", "3月", "4月", "5月", "6月"});
        chartData.put("data", new Integer[]{1200, 1500, 1800, 2200, 2800, 3500});
        result.put("chartData", chartData);
        
        return result;
    }

    @Override
    public Map<String, Object> getAlertStatistics() {
        Map<String, Object> result = new HashMap<>();
        
        LambdaQueryWrapper<AlertRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AlertRecord::getDeleted, 0);
        
        List<AlertRecord> alerts = alertRecordMapper.selectList(wrapper);
        
        long criticalCount = alerts.stream().filter(a -> "error".equals(a.getLevel())).count();
        long importantCount = alerts.stream().filter(a -> "warning".equals(a.getLevel())).count();
        long normalCount = alerts.stream().filter(a -> "info".equals(a.getLevel())).count();
        long unhandledCount = alerts.stream().filter(a -> "unhandled".equals(a.getStatus())).count();
        
        result.put("total", alerts.size());
        result.put("critical", criticalCount);
        result.put("important", importantCount);
        result.put("normal", normalCount);
        result.put("unhandled", unhandledCount);
        
        return result;
    }

    @Override
    public Map<String, Object> getDeviceStatistics() {
        Map<String, Object> result = new HashMap<>();
        
        LambdaQueryWrapper<IoTDevice> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(IoTDevice::getDeleted, 0);
        
        List<IoTDevice> devices = ioTDeviceMapper.selectList(wrapper);
        
        long onlineCount = devices.stream().filter(d -> "online".equals(d.getStatus())).count();
        long offlineCount = devices.stream().filter(d -> "offline".equals(d.getStatus())).count();
        
        result.put("total", devices.size());
        result.put("online", onlineCount);
        result.put("offline", offlineCount);
        
        return result;
    }

    @Override
    public Map<String, Object> getTraceStatistics() {
        Map<String, Object> result = new HashMap<>();
        result.put("total", 2340);
        result.put("activated", 1890);
        result.put("inactive", 450);
        
        return result;
    }

    private int getFarmCount() {
        LambdaQueryWrapper<Farm> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Farm::getDeleted, 0);
        return (int) (long) farmMapper.selectCount(wrapper);
    }

    private int getPlotCount() {
        return 45;
    }

    private int getTaskCount() {
        LambdaQueryWrapper<Task> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Task::getDeleted, 0);
        return (int) (long) taskMapper.selectCount(wrapper);
    }

    private int getAlertCount() {
        LambdaQueryWrapper<AlertRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(AlertRecord::getDeleted, 0);
        wrapper.eq(AlertRecord::getStatus, "unhandled");
        return (int) (long) alertRecordMapper.selectCount(wrapper);
    }

    private int getTraceCount() {
        return 2340;
    }

    private int getDeviceCount() {
        LambdaQueryWrapper<IoTDevice> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(IoTDevice::getDeleted, 0);
        return (int) (long) ioTDeviceMapper.selectCount(wrapper);
    }
}
