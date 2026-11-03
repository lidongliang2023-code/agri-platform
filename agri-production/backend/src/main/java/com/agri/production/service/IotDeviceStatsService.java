package com.agri.production.service;

import com.agri.production.entity.IoTDevice;
import com.agri.production.integration.IotDeviceClient;
import com.agri.production.mapper.IoTDeviceMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 设备数量统计（口径统一到物联网系统）。
 *
 * <p><b>为什么需要这一层</b>：设备台账在 2026-10-28 收敛到 agri-iot 的 {@code iot_device}，
 * 生产端的 {@code agri_prod_iot_device} 不再更新。但管理端大盘、农场详情、报表、AI 助手
 * 这四处仍在用 MyBatis-Plus 直接 count 那张历史副本 —— 不换的话，页面上会出现
 * 「设备列表 29 台、大盘 13 台」这种自相矛盾的数字，而且没有任何报错提示。</p>
 *
 * <p><b>为什么做降级</b>：这四处都在读接口里同步调用，一旦物联网服务抖动，
 * 让整个大盘/报表 500 的代价远大于"数字暂时偏旧"。所以物联网端不可达时
 * 回落到本地历史副本，并在日志里留痕 —— 这是<b>降级</b>，不是"第二套数据"。</p>
 *
 * <p><b>令牌透传</b>：用调用方自己的 {@code Authorization}（见
 * {@link TenantContextService#currentAuthorization()}），物联网端据此判权并反查租户农场范围。
 * 拿不到令牌（无请求上下文）时直接走降级。</p>
 */
@Slf4j
@Service
public class IotDeviceStatsService {

    /** 本地历史副本里代表"在线"的状态写法 */
    private static final List<String> LOCAL_ONLINE = List.of("online", "ONLINE", "1");

    private final IotDeviceClient iotDeviceClient;
    private final IoTDeviceMapper deviceMapper;

    public IotDeviceStatsService(IotDeviceClient iotDeviceClient, IoTDeviceMapper deviceMapper) {
        this.iotDeviceClient = iotDeviceClient;
        this.deviceMapper = deviceMapper;
    }

    /**
     * 统计设备数量。
     *
     * @param tenantId 租户 ID（降级路径要用）
     * @param farmId   农场 ID，为空表示该租户全部农场
     * @return total / online / offline / alert，值类型统一为 long
     */
    public Map<String, Object> counts(String tenantId, Long farmId) {
        Map<String, Object> stats = fromIot(farmId);
        if (stats != null) {
            return stats;
        }
        return fromLocal(tenantId, farmId);
    }

    /**
     * 只要总数与在线数（大部分页面只用到这两个）。
     *
     * @param tenantId 租户 ID
     * @param farmId   农场 ID，可空
     * @return 长度 2 的数组：[总数, 在线数]
     */
    public long[] totalAndOnline(String tenantId, Long farmId) {
        Map<String, Object> stats = counts(tenantId, farmId);
        return new long[]{longValue(stats.get("total")), longValue(stats.get("online"))};
    }

    /** 在线设备数（farmId 可空）。 */
    public long onlineCount(String tenantId, Long farmId) {
        return totalAndOnline(tenantId, farmId)[1];
    }

    /** 设备总数（farmId 可空）。 */
    public long totalCount(String tenantId, Long farmId) {
        return totalAndOnline(tenantId, farmId)[0];
    }

    /**
     * 从物联网系统取数。
     *
     * @return 统计结果；无令牌或调用失败时返回 {@code null}，由调用方降级
     */
    private Map<String, Object> fromIot(Long farmId) {
        String authorization = TenantContextService.currentAuthorization();
        if (authorization == null || authorization.isBlank()) {
            log.debug("无请求上下文令牌，设备统计走本地历史副本降级");
            return null;
        }
        try {
            Map<String, Object> raw = iotDeviceClient.deviceStats(authorization, farmId);
            if (raw == null) {
                return null;
            }
            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("total", longValue(raw.get("total")));
            stats.put("online", longValue(raw.get("online")));
            stats.put("offline", longValue(raw.get("offline")));
            stats.put("alert", longValue(raw.get("alert")));
            return stats;
        } catch (RuntimeException e) {
            log.warn("读取物联网设备统计失败，回落本地历史副本：{}", e.getMessage());
            return null;
        }
    }

    /**
     * 降级路径：读生产端那张不再更新的历史副本。
     *
     * <p>保留它是为了"物联网端挂了页面也别白屏"，<b>不是</b>为了维护第二套台账 ——
     * 这张表已经没有任何写入入口（设备增删改都收归物联网端）。</p>
     */
    private Map<String, Object> fromLocal(String tenantId, Long farmId) {
        LambdaQueryWrapper<IoTDevice> base = new LambdaQueryWrapper<IoTDevice>()
                .eq(IoTDevice::getTenantId, tenantId)
                .eq(IoTDevice::getDeleted, 0L);
        if (farmId != null && farmId > 0) {
            base.eq(IoTDevice::getFarmId, farmId);
        }
        long total = orZero(deviceMapper.selectCount(base));
        long online = orZero(deviceMapper.selectCount(new LambdaQueryWrapper<IoTDevice>()
                .eq(IoTDevice::getTenantId, tenantId)
                .eq(IoTDevice::getDeleted, 0L)
                .eq(farmId != null && farmId > 0, IoTDevice::getFarmId, farmId)
                .in(IoTDevice::getStatus, LOCAL_ONLINE)));
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", total);
        stats.put("online", online);
        stats.put("offline", Math.max(total - online, 0));
        stats.put("alert", 0L);
        return stats;
    }

    private static long orZero(Long value) {
        return value == null ? 0L : value;
    }

    private static long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return 0L;
        }
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }
}
