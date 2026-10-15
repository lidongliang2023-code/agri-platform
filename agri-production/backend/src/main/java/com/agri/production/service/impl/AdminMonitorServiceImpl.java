package com.agri.production.service.impl;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.AlertRule;
import com.agri.production.entity.Farm;
import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.Plot;
import com.agri.production.entity.Task;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.AlertRuleMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.IoTDeviceMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.service.IAdminMonitorService;
import com.agri.production.vo.AdminMonitorAlertVO;
import com.agri.production.vo.AdminMonitorDeviceVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 运营端生产监控实现。口径对照 core-platform 的 AdminMonitorService（本页今天的实现），
 * 按本服务的表落地。
 */
@Slf4j
@Service
public class AdminMonitorServiceImpl implements IAdminMonitorService {

    /** 页面用的状态键（顺序即展示顺序）：MonitorCenter 按这几个键取数与求和 */
    private static final List<String> MONITOR_KEYS = List.of("pending", "assigned", "doing", "done", "rejected");
    private static final String DEVICE_ONLINE = "online";
    /** 出参时间统一到秒：LocalDateTime.toString() 会带纳秒，直接丢给前端很难看 */
    private static final java.time.format.DateTimeFormatter DATE_TIME =
            java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final IoTDeviceMapper iotDeviceMapper;
    private final AlertRecordMapper alertRecordMapper;
    private final AlertRuleMapper alertRuleMapper;
    private final TaskMapper taskMapper;
    private final FarmMapper farmMapper;
    private final PlotMapper plotMapper;

    public AdminMonitorServiceImpl(IoTDeviceMapper iotDeviceMapper,
                                   AlertRecordMapper alertRecordMapper,
                                   AlertRuleMapper alertRuleMapper,
                                   TaskMapper taskMapper,
                                   FarmMapper farmMapper,
                                   PlotMapper plotMapper) {
        this.iotDeviceMapper = iotDeviceMapper;
        this.alertRecordMapper = alertRecordMapper;
        this.alertRuleMapper = alertRuleMapper;
        this.taskMapper = taskMapper;
        this.farmMapper = farmMapper;
        this.plotMapper = plotMapper;
    }

    @Override
    public Map<String, Object> overview() {
        // 设备口径 = is_enabled 1 的设备（与 /devices 返回的集合一致）：
        // 两边口径不一致时，页面左侧"设备总数"卡片与右侧列表的条数会对不上
        long total = countDevices(false);
        long online = countDevices(true);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("deviceTotal", total);
        result.put("deviceOnline", online);
        result.put("onlineRate", total == 0 ? 0 : online * 100 / total);
        result.put("alertPending", alertRecordMapper.selectCount(new LambdaQueryWrapper<AlertRecord>()
                .eq(AlertRecord::getStatus, "unhandled")));
        result.put("ruleEnabled", alertRuleMapper.selectCount(new LambdaQueryWrapper<AlertRule>()
                .eq(AlertRule::getIsEnabled, 1)));
        return result;
    }

    private long countDevices(boolean onlineOnly) {
        LambdaQueryWrapper<IoTDevice> w = new LambdaQueryWrapper<IoTDevice>().eq(IoTDevice::getIsEnabled, 1);
        if (onlineOnly) {
            w.eq(IoTDevice::getStatus, DEVICE_ONLINE);
        }
        Long hits = iotDeviceMapper.selectCount(w);
        return hits == null ? 0L : hits;
    }

    @Override
    public List<AdminMonitorDeviceVO> devices(boolean onlineOnly) {
        LambdaQueryWrapper<IoTDevice> w = new LambdaQueryWrapper<IoTDevice>().eq(IoTDevice::getIsEnabled, 1);
        if (onlineOnly) {
            w.eq(IoTDevice::getStatus, DEVICE_ONLINE);
        }
        w.orderByDesc(IoTDevice::getLastOnlineTime).orderByAsc(IoTDevice::getId);
        List<IoTDevice> devices = iotDeviceMapper.selectList(w);
        Map<Long, String> farmNames = farmNames(devices.stream().map(IoTDevice::getFarmId).toList());
        List<AdminMonitorDeviceVO> rows = new ArrayList<>();
        for (IoTDevice device : devices) {
            rows.add(AdminMonitorDeviceVO.of(device, farmNames.get(device.getFarmId())));
        }
        return rows;
    }

    /** 一次把用到的农场名查出来，避免逐行查库 */
    private Map<Long, String> farmNames(List<Long> farmIds) {
        List<Long> ids = farmIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return farmMapper.selectList(new LambdaQueryWrapper<Farm>().in(Farm::getId, ids)).stream()
                .collect(Collectors.toMap(Farm::getId, Farm::getFarmName, (a, b) -> a));
    }

    @Override
    public List<AdminMonitorAlertVO> realtimeAlerts(int minutes) {
        int window = minutes > 0 ? minutes : 60;
        List<AlertRecord> alerts = alertRecordMapper.selectList(new LambdaQueryWrapper<AlertRecord>()
                .ge(AlertRecord::getCreateTime, LocalDateTime.now().minusMinutes(window))
                .orderByDesc(AlertRecord::getCreateTime));
        Map<Long, String> plotNames = plotNames(alerts.stream().map(AlertRecord::getPlotId).toList());
        List<AdminMonitorAlertVO> rows = new ArrayList<>();
        for (AlertRecord alert : alerts) {
            rows.add(AdminMonitorAlertVO.of(alert, plotNames.get(alert.getPlotId())));
        }
        return rows;
    }

    private Map<Long, String> plotNames(List<Long> plotIds) {
        List<Long> ids = plotIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return plotMapper.selectList(new LambdaQueryWrapper<Plot>().in(Plot::getId, ids)).stream()
                .collect(Collectors.toMap(Plot::getId, Plot::getPlotName, (a, b) -> a));
    }

    @Override
    public List<Map<String, Object>> taskStatusStats() {
        // 逐键查计数而不是"总数减一下"：减法算出来的数既不是"待处理"也不是"已完成"，没有意义
        List<Task> all = taskMapper.selectList(new LambdaQueryWrapper<Task>());
        Map<String, Integer> byKey = all.stream().collect(Collectors.toMap(
                task -> statusToMonitorKey(task.getStatus()), task -> 1, Integer::sum));
        List<Map<String, Object>> result = new ArrayList<>();
        for (String key : MONITOR_KEYS) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("status", key);
            row.put("count", byKey.getOrDefault(key, 0));
            result.add(row);
        }
        return result;
    }

    /**
     * 任务状态 → 页面状态键。
     *
     * <p>本服务的状态词表是 pending / assigned / doing(ing) / completed / rejected（见 Task 状态机），
     * 页面要的是 pending / assigned / doing / done / rejected —— 只有 completed→done 是真翻译，
     * 其余同名。认不出的状态归到 pending（未完成），并**留日志**，免得将来加了新状态却悄悄算错。</p>
     */
    private static String statusToMonitorKey(String status) {
        if (status == null || status.isBlank()) {
            return "pending";
        }
        return switch (status.trim().toLowerCase()) {
            case "pending" -> "pending";
            case "assigned" -> "assigned";
            case "doing", "in_progress", "processing" -> "doing";
            case "completed", "done", "finished" -> "done";
            case "rejected" -> "rejected";
            default -> {
                log.warn("任务状态 {} 无法映射到监控页状态键，已按 pending 统计", status);
                yield "pending";
            }
        };
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> urgeTask(Long taskId, String operator) {
        Task task = taskId == null ? null : taskMapper.selectById(taskId);
        if (task == null) {
            throw new BusinessException(404, "任务不存在：" + taskId);
        }
        task.setUrgeCount((task.getUrgeCount() == null ? 0 : task.getUrgeCount()) + 1);
        task.setLastUrgeTime(LocalDateTime.now());
        // 只在调用方给了操作人时才覆盖：页面当前不传 operator，直接 set 会把上一次的催办人清成 null
        if (operator != null && !operator.isBlank()) {
            task.setLastUrgeBy(operator.trim());
        }
        task.setUpdateTime(LocalDateTime.now());
        taskMapper.updateById(task);
        log.info("任务催办：id={} 第 {} 次，操作人={}", taskId, task.getUrgeCount(), operator);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("taskId", task.getId());
        row.put("taskCode", task.getTaskCode());
        row.put("urgeCount", task.getUrgeCount());
        row.put("lastUrgeTime", task.getLastUrgeTime() == null ? null : DATE_TIME.format(task.getLastUrgeTime()));
        row.put("lastUrgeBy", task.getLastUrgeBy());
        return row;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> requestReboot(Long deviceId, String operator) {
        IoTDevice device = deviceId == null ? null : iotDeviceMapper.selectById(deviceId);
        if (device == null) {
            throw new BusinessException(404, "设备不存在：" + deviceId);
        }
        device.setRebootRequestedAt(LocalDateTime.now());
        device.setUpdateTime(LocalDateTime.now());
        iotDeviceMapper.updateById(device);
        log.info("设备重启指令已记录：id={} code={} 操作人={}（本部署无设备网关，未真正重启）",
                deviceId, device.getDeviceCode(), operator);
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("deviceId", device.getId());
        row.put("deviceCode", device.getDeviceCode());
        row.put("rebootRequestedAt", device.getRebootRequestedAt() == null
                ? null : DATE_TIME.format(device.getRebootRequestedAt()));
        return row;
    }
}
