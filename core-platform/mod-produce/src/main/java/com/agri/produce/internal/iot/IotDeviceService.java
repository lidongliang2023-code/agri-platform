package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * IoT 设备档案（采集与长连接在 satellite-iot） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class IotDeviceService {

    private static final String ID_PREFIX = "DEVC";

    /** 运行态筛选值：在线 */
    public static final String RUN_STATUS_ONLINE = "ONLINE";
    /** 运行态筛选值：离线 */
    public static final String RUN_STATUS_OFFLINE = "OFFLINE";
    /** 运行态筛选值：故障 */
    public static final String RUN_STATUS_FAULT = "FAULT";

    /**
     * 心跳有效窗口（分钟）：超过该窗口视为离线。
     *
     * <p>这是「在线/离线」判定的<strong>唯一口径</strong>，指令送达判定
     * （{@link IotCommandService}）与列表运行态筛选共用此常量，避免两处漂移。</p>
     */
    public static final long HEARTBEAT_VALID_MINUTES = 10L;

    /**
     * 故障态判定口径（团队裁决）：<strong>故障 = 该设备存在 {@code status='PENDING'} 的告警</strong>。
     *
     * <p>不新增 {@code fault_flag} 列、不用 {@code quality_flag=0}，理由：
     * 告警表 {@code prod_alert_info} 已有 {@code device_id} 与 {@code handle_by/handle_time/handle_remark}，
     * 本身就是「设备级、且有人要处理」的状态事实来源；再开一个状态列会形成双写，
     * 两边不一致时无从判断该信谁。{@code quality_flag} 是单条读数的质量标记，
     * 一条脏读数不代表设备故障。</p>
     */
    private static final String FAULT_DEVICE_SUB_SQL =
            "SELECT device_id FROM prod_alert_info"
                    + " WHERE deleted = 0 AND status = 'PENDING' AND device_id IS NOT NULL";

    private final IotDeviceMapper iotDeviceMapper;

    /**
     * 分页查询。
     *
     * @param keyword   deviceName 模糊关键字
     * @param status    档案状态过滤（1启用 0停用），可为空
     * @param runStatus 运行态过滤 ONLINE/OFFLINE/FAULT，可为空表示不过滤
     * @return 分页结果
     */
    public PageResult<IotDeviceEntity> page(long page, long size, String keyword,
                                            Integer status, String runStatus) {
        LambdaQueryWrapper<IotDeviceEntity> query = new LambdaQueryWrapper<IotDeviceEntity>()
                .like(keyword != null && !keyword.isBlank(), IotDeviceEntity::getDeviceName, keyword)
                .eq(status != null, IotDeviceEntity::getStatus, status);
        applyRunStatus(query, runStatus);

        Page<IotDeviceEntity> result = iotDeviceMapper.selectPage(new Page<>(page, size),
                query.orderByDesc(IotDeviceEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 按运行态追加查询条件（在线/离线/故障）。
     *
     * <p>在线 = {@code online_flag = 1} <b>且</b>最后心跳在 {@link #HEARTBEAT_VALID_MINUTES} 分钟内；
     * 离线 = 其余情形（含从未心跳）。</p>
     *
     * <p>故障 = 该设备存在 {@code prod_alert_info.status='PENDING'} 的未处置告警，见
     * {@link #FAULT_DEVICE_SUB_SQL}。<strong>故障与在线/离线不是互斥口径</strong>：
     * 一台在线设备同样可以有未处置告警，故三个取值各自独立判定，不做互斥切分。</p>
     *
     * @param query     查询条件
     * @param runStatus 运行态，可为空
     */
    private static void applyRunStatus(LambdaQueryWrapper<IotDeviceEntity> query, String runStatus) {
        if (runStatus == null || runStatus.isBlank()) {
            return;
        }
        String normalized = runStatus.trim().toUpperCase(Locale.ROOT);
        LocalDateTime earliestAlive = LocalDateTime.now().minusMinutes(HEARTBEAT_VALID_MINUTES);
        switch (normalized) {
            case RUN_STATUS_ONLINE -> query.eq(IotDeviceEntity::getOnlineFlag, 1)
                    .ge(IotDeviceEntity::getLastHeartbeatAt, earliestAlive);
            case RUN_STATUS_OFFLINE -> query.and(wrapper -> wrapper
                    .eq(IotDeviceEntity::getOnlineFlag, 0)
                    .or().isNull(IotDeviceEntity::getLastHeartbeatAt)
                    .or().lt(IotDeviceEntity::getLastHeartbeatAt, earliestAlive));
            case RUN_STATUS_FAULT -> query.inSql(IotDeviceEntity::getDeviceId, FAULT_DEVICE_SUB_SQL);
            default -> throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "不支持的运行态：" + runStatus + "，可选 ONLINE / OFFLINE / FAULT");
        }
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public IotDeviceEntity detail(String id) {
        IotDeviceEntity entity = iotDeviceMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public IotDeviceEntity create(IotDeviceEntity entity) {
        if (entity.getDeviceId() == null || entity.getDeviceId().isBlank()) {
            entity.setDeviceId(ProduceIds.newId(ID_PREFIX));
        }
        iotDeviceMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public IotDeviceEntity update(String id, IotDeviceEntity entity) {
        entity.setDeviceId(id);
        iotDeviceMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        iotDeviceMapper.deleteById(id);
    }

    /** 心跳上报：置在线并刷新心跳时间 */
    @Transactional
    public IotDeviceEntity heartbeat(String deviceId) {
        IotDeviceEntity device = detail(deviceId);
        device.setOnlineFlag(1);
        device.setLastHeartbeatAt(LocalDateTime.now());
        iotDeviceMapper.updateById(device);
        return device;
    }

    /** 离线设备清单（超过 minutes 未心跳） */
    public List<IotDeviceEntity> listOffline(int minutes) {
        return iotDeviceMapper.selectList(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getStatus, 1)
                .lt(IotDeviceEntity::getLastHeartbeatAt, LocalDateTime.now().minusMinutes(minutes)));
    }

    /** 已绑定地块的设备清单 */
    public List<IotDeviceEntity> listBindings(String plotId) {
        return iotDeviceMapper.selectList(new LambdaQueryWrapper<IotDeviceEntity>()
                .eq(IotDeviceEntity::getStatus, 1)
                .isNotNull(IotDeviceEntity::getPlotId)
                .eq(plotId != null && !plotId.isBlank(), IotDeviceEntity::getPlotId, plotId)
                .orderByAsc(IotDeviceEntity::getDeviceCode));
    }
}
