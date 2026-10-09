package com.agri.produce.internal.admin;

import com.agri.produce.internal.alert.AlertInfoEntity;
import com.agri.produce.internal.alert.AlertInfoMapper;
import com.agri.produce.internal.alert.AlertRuleEntity;
import com.agri.produce.internal.alert.AlertRuleMapper;
import com.agri.produce.internal.iot.IotDeviceEntity;
import com.agri.produce.internal.iot.IotDeviceMapper;
import com.agri.produce.internal.iot.IotReadingEntity;
import com.agri.produce.internal.iot.IotReadingMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import com.agri.produce.internal.task.TaskInfoEntity;
import com.agri.produce.internal.task.TaskInfoMapper;
import com.agri.produce.internal.input.InputInfoEntity;
import com.agri.produce.internal.input.InputInfoMapper;

/**
 * 运营端：实时监测（设备在线率、最新读数、实时告警）。
 */
@Service
@RequiredArgsConstructor
public class AdminMonitorService {

    private final IotDeviceMapper iotDeviceMapper;
    private final InputInfoMapper inputInfoMapper;
    private final TaskInfoMapper taskInfoMapper;
    private final IotReadingMapper iotReadingMapper;
    private final AlertInfoMapper alertInfoMapper;
    private final AlertRuleMapper alertRuleMapper;

    /**
     * 监测总览：设备在线率、实时告警数、启用规则数。
     *
     * @return 监测指标
     */
    public Map<String, Object> overview() {
        long total = iotDeviceMapper.selectCount(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getStatus, 1));
        long online = iotDeviceMapper.selectCount(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getOnlineFlag, 1));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("deviceTotal", total);
        result.put("deviceOnline", online);
        result.put("onlineRate", total == 0 ? 0 : online * 100 / total);
        result.put("alertPending", alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                .eq(AlertInfoEntity::getStatus, "PENDING")));
        result.put("ruleEnabled", alertRuleMapper.selectCount(new LambdaQueryWrapper<AlertRuleEntity>()
                .eq(AlertRuleEntity::getEnabledFlag, 1)));
        return result;
    }

    /**
     * 设备运行状态清单。
     *
     * @param onlineOnly 仅在线设备
     * @return 设备列表
     */
    public List<IotDeviceEntity> devices(boolean onlineOnly) {
        return iotDeviceMapper.selectList(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getStatus, 1)
                .eq(onlineOnly, IotDeviceEntity::getOnlineFlag, 1)
                .orderByDesc(IotDeviceEntity::getLastHeartbeatAt));
    }

    /**
     * 实时告警流（近 minutes 分钟）。
     *
     * @param minutes 时间窗口
     * @return 告警列表
     */
    public List<AlertInfoEntity> realtime(int minutes) {
        return alertInfoMapper.selectList(new LambdaQueryWrapper<AlertInfoEntity>()
                .ge(AlertInfoEntity::getAlertTime, LocalDateTime.now().minusMinutes(minutes))
                .orderByDesc(AlertInfoEntity::getAlertTime));
    }

    /**
     * 设备最新读数（每设备取一条）。
     *
     * @param deviceId 设备ID
     * @return 最新读数
     */
    public IotReadingEntity latestReading(String deviceId) {
        List<IotReadingEntity> list = iotReadingMapper.selectList(new LambdaQueryWrapper<IotReadingEntity>()
                .eq(IotReadingEntity::getDeviceId, deviceId)
                .orderByDesc(IotReadingEntity::getReadTime)
                .last("LIMIT 1"));
        return list.isEmpty() ? null : list.get(0);
    }

    /** 任务监控：按状态聚合 */
    public List<Map<String, Object>> taskMonitor() {
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (String status : List.of("pending", "assigned", "doing", "done", "rejected")) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("status", status);
            row.put("count", taskInfoMapper.selectCount(new LambdaQueryWrapper<TaskInfoEntity>()
                    .eq(TaskInfoEntity::getStatus, status)));
            result.add(row);
        }
        return result;
    }

    /** 投入品监控：库存量 + 是否触发预警 */
    public List<Map<String, Object>> inputMonitor() {
        List<InputInfoEntity> inputs = inputInfoMapper.selectList(new LambdaQueryWrapper<InputInfoEntity>()
                .eq(InputInfoEntity::getStatus, 1));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (InputInfoEntity input : inputs) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("inputId", input.getInputId());
            row.put("inputName", input.getInputName());
            row.put("stockQty", input.getStockQty());
            row.put("warnQty", input.getWarnQty());
            row.put("warning", input.getWarnQty() != null && input.getStockQty() != null
                    && input.getStockQty().compareTo(input.getWarnQty()) <= 0);
            result.add(row);
        }
        return result;
    }
}
