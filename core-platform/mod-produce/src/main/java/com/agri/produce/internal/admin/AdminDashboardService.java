package com.agri.produce.internal.admin;

import com.agri.produce.internal.alert.AlertInfoEntity;
import com.agri.produce.internal.alert.AlertInfoMapper;
import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.produce.internal.farm.FarmInfoMapper;
import com.agri.produce.internal.harvest.HarvestBatchEntity;
import com.agri.produce.internal.harvest.HarvestBatchMapper;
import com.agri.produce.internal.iot.IotDeviceEntity;
import com.agri.produce.internal.iot.IotDeviceMapper;
import com.agri.produce.internal.plot.PlotInfoEntity;
import com.agri.produce.internal.plot.PlotInfoMapper;
import com.agri.produce.internal.quality.InspectionEntity;
import com.agri.produce.internal.quality.InspectionMapper;
import com.agri.produce.internal.task.TaskInfoEntity;
import com.agri.produce.internal.task.TaskInfoMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端看板聚合服务（只读汇总，跨生产域子包查询，属同模块内部调用）。
 */
@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final FarmInfoMapper farmInfoMapper;
    private final PlotInfoMapper plotInfoMapper;
    private final TaskInfoMapper taskInfoMapper;
    private final HarvestBatchMapper harvestBatchMapper;
    private final InspectionMapper inspectionMapper;
    private final AlertInfoMapper alertInfoMapper;
    private final IotDeviceMapper iotDeviceMapper;

    /**
     * 看板总览：农场/地块/任务/批次/告警/设备在线。
     *
     * @return 指标集合
     */
    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmCount", farmInfoMapper.selectCount(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1)));
        result.put("plotCount", plotInfoMapper.selectCount(new LambdaQueryWrapper<PlotInfoEntity>()
                .ne(PlotInfoEntity::getStatus, 0)));
        result.put("taskPending", taskInfoMapper.selectCount(new LambdaQueryWrapper<TaskInfoEntity>()
                .in(TaskInfoEntity::getStatus, List.of("pending", "assigned", "doing"))));
        result.put("batchInStock", harvestBatchMapper.selectCount(new LambdaQueryWrapper<HarvestBatchEntity>()
                .eq(HarvestBatchEntity::getStatus, 1)));
        result.put("inspectionPass", inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "PASS")));
        result.put("inspectionFail", inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "FAIL")));
        result.put("alertPending", alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                .eq(AlertInfoEntity::getStatus, "PENDING")));
        result.put("deviceOnline", iotDeviceMapper.selectCount(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getOnlineFlag, 1)));
        result.put("deviceTotal", iotDeviceMapper.selectCount(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getStatus, 1)));
        return result;
    }

    /**
     * 种植面积排行（按农场取前 limit 名）。
     *
     * @param limit 返回条数
     * @return 排行列表
     */
    public List<Map<String, Object>> rank(int limit) {
        List<FarmInfoEntity> farms = farmInfoMapper.selectList(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (FarmInfoEntity farm : farms) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("farmId", farm.getFarmId());
            row.put("farmName", farm.getFarmName());
            row.put("areaTotal", farm.getAreaTotal() == null ? BigDecimal.ZERO : farm.getAreaTotal());
            row.put("plotCount", plotInfoMapper.selectCount(new LambdaQueryWrapper<PlotInfoEntity>()
                    .eq(PlotInfoEntity::getFarmId, farm.getFarmId())));
            rows.add(row);
        }
        rows.sort((a, b) -> ((BigDecimal) b.get("areaTotal")).compareTo((BigDecimal) a.get("areaTotal")));
        return rows.size() <= limit ? rows : new ArrayList<>(rows.subList(0, limit));
    }

    /**
     * 告警级别分布趋势（看板饼图）。
     *
     * @return 级别 → 数量
     */
    public Map<String, Object> alertTrend() {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String level : List.of("INFO", "WARN", "CRITICAL")) {
            result.put(level, alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                    .eq(AlertInfoEntity::getAlertLevel, level)));
        }
        return result;
    }
}
