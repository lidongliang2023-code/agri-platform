package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.IotBinding;
import com.agri.production.entity.IotCommand;
import com.agri.production.entity.IotMaintenance;
import com.agri.production.mapper.IoTDeviceMapper;
import com.agri.production.mapper.IotBindingMapper;
import com.agri.production.mapper.IotCommandMapper;
import com.agri.production.mapper.IotMaintenanceMapper;
import com.agri.production.integration.IotDeviceClient;
import com.agri.production.service.IIotOpsService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.IotBindingVO;
import com.agri.production.vo.IotCommandVO;
import com.agri.production.vo.IotDeviceVO;
import com.agri.production.vo.IotMaintenanceVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * IoT 设备运维实现。
 *
 * <p>三条纪律落在这里：</p>
 * <ul>
 *   <li><b>指令只记录不真下发</b>：本部署没有设备通道，状态固定 ISSUED、回执写明未送达，
 *       响应带 {@code delivery=record-only} —— 不按"设备在线就算成功"编一个执行结果；</li>
 *   <li><b>设备标识统一换算</b>：本地主键 / 设备编码 / 平台侧标识（platform_device_id）都接受，
 *       落库统一写本地主键 + 设备编码，避免"同一台设备在两行里是两种写法"；</li>
 *   <li><b>查不到就说查不到</b>：心跳/维修针对不存在的设备报 404，不做"看起来成功"的空操作。</li>
 * </ul>
 */
@Slf4j
@Service
public class IotOpsServiceImpl implements IIotOpsService {

    /** 指令状态：已记录（本部署唯一取值）。 */
    public static final String COMMAND_ISSUED = "ISSUED";
    /** 指令回执文案（说明为什么状态不是"成功"）。 */
    private static final String RECEIPT_NOT_DELIVERED =
            "已记录：本部署未接设备下发通道，指令未实际送达设备（delivery=record-only）";
    /** 绑定状态白名单。 */
    private static final List<String> BIND_TYPES = List.of("PLOT", "GREENHOUSE", "FARM");
    private static final List<String> BIND_STATUSES = List.of("BOUND", "UNBOUND", "PAUSED");
    /** 维修类型白名单（与页面 IotMaintainType 一致）。 */
    private static final List<String> MAINTAIN_TYPES =
            List.of("INSPECT", "REPAIR", "REPLACE", "CALIBRATE", "UPGRADE");
    private static final int LIMIT_DEFAULT = 100;
    private static final int LIMIT_MAX = 500;
    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final IotBindingMapper bindingMapper;
    private final IotCommandMapper commandMapper;
    private final IotMaintenanceMapper maintenanceMapper;
    private final IoTDeviceMapper deviceMapper;
    private final IotDeviceClient iotDeviceClient;
    private final JdbcTemplate jdbc;

    public IotOpsServiceImpl(IotBindingMapper bindingMapper, IotCommandMapper commandMapper,
                             IotMaintenanceMapper maintenanceMapper, IoTDeviceMapper deviceMapper,
                             IotDeviceClient iotDeviceClient, JdbcTemplate jdbc) {
        this.bindingMapper = bindingMapper;
        this.commandMapper = commandMapper;
        this.maintenanceMapper = maintenanceMapper;
        this.deviceMapper = deviceMapper;
        this.iotDeviceClient = iotDeviceClient;
        this.jdbc = jdbc;
    }

    /* ==================== 绑定 ==================== */

    @Override
    public List<IotBindingVO> listBindings(String tenantId, BindingQuery query) {
        return bindingMapper.selectList(bindingWrapper(tenantId, query)).stream()
                .map(IotBindingVO::of)
                .toList();
    }

    @Override
    public PageResult<IotBindingVO> pageBindings(String tenantId, int pageNum, int pageSize, BindingQuery query) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        Page<IotBinding> page = bindingMapper.selectPage(new Page<>(p, s),
                bindingWrapper(tenantId, query).orderByDesc(IotBinding::getBoundAt).orderByDesc(IotBinding::getBindingId));
        return PageResult.of(page.getRecords().stream().map(IotBindingVO::of).toList(),
                page.getTotal(), p, s);
    }

    private LambdaQueryWrapper<IotBinding> bindingWrapper(String tenantId, BindingQuery query) {
        requireTenant(tenantId);
        LambdaQueryWrapper<IotBinding> w = new LambdaQueryWrapper<IotBinding>().eq(IotBinding::getTenantId, tenantId);
        if (query != null) {
            String deviceId = blankToNull(query.deviceId());
            if (deviceId != null) {
                // 设备标识先尝试换算成本地主键；换不出来就按原值匹配（历史行/未收敛标识仍能筛到）
                IoTDevice device = resolveDevice(tenantId, deviceId);
                w.eq(IotBinding::getDeviceId, device == null ? deviceId : String.valueOf(device.getId()));
            }
            String bindType = blankToNull(query.bindType());
            if (bindType != null) {
                w.eq(IotBinding::getBindType, bindType.toUpperCase(Locale.ROOT));
            }
            String targetId = blankToNull(query.bindTargetId());
            if (targetId != null) {
                w.eq(IotBinding::getBindTargetId, targetId);
            }
            String status = blankToNull(query.status());
            if (status == null) {
                // 不传状态时只给 BOUND（与前端契约注释一致）
                w.eq(IotBinding::getStatus, "BOUND");
            } else if (!"ALL".equalsIgnoreCase(status)) {
                w.eq(IotBinding::getStatus, status.toUpperCase(Locale.ROOT));
            }
        } else {
            w.eq(IotBinding::getStatus, "BOUND");
        }
        return w;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IotBindingVO bind(String tenantId, BindPayload payload) {
        requireTenant(tenantId);
        if (payload == null) {
            throw new BusinessException(400, "请求体不能为空");
        }
        String rawDeviceId = requireText(payload.deviceId(), "设备标识", 64);
        String bindType = requireText(payload.bindType(), "绑定类型", 16).toUpperCase(Locale.ROOT);
        if (!BIND_TYPES.contains(bindType)) {
            throw new BusinessException(400, "绑定类型应为 PLOT / GREENHOUSE / FARM：" + payload.bindType());
        }
        String targetId = requireText(payload.bindTargetId(), "绑定对象标识", 64);
        if (payload.frequency() != null && payload.frequency() <= 0) {
            throw new BusinessException(400, "采集频率应为正整数（分钟）：" + payload.frequency());
        }

        IoTDevice device = resolveDevice(tenantId, rawDeviceId);
        String deviceId = device == null ? rawDeviceId : String.valueOf(device.getId());
        String metrics = payload.metrics() == null ? null : String.join(",",
                payload.metrics().stream().filter(m -> m != null && !m.isBlank()).map(String::trim).toList());

        // 同「设备 + 类型 + 对象」= upsert：重复绑定把原行重新置为 BOUND 并刷新指标/频率
        IotBinding entity = bindingMapper.selectOne(new LambdaQueryWrapper<IotBinding>()
                .eq(IotBinding::getTenantId, tenantId)
                .eq(IotBinding::getDeviceId, deviceId)
                .eq(IotBinding::getBindType, bindType)
                .eq(IotBinding::getBindTargetId, targetId)
                .last("LIMIT 1"));
        boolean created = entity == null;
        if (created) {
            entity = new IotBinding();
            entity.setBindingId("BIND" + LocalDateTime.now().format(ID_FORMAT)
                    + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
            entity.setTenantId(tenantId);
        }
        entity.setDeviceId(deviceId);
        entity.setDeviceCode(device == null ? null : device.getDeviceCode());
        entity.setDeviceName(device == null ? null : device.getDeviceName());
        entity.setBindType(bindType);
        entity.setBindTargetId(targetId);
        entity.setBindTargetName(blankToNull(payload.targetName()));
        entity.setMetrics(metrics);
        entity.setFrequency(payload.frequency());
        entity.setStatus("BOUND");
        entity.setBoundAt(LocalDateTime.now());
        entity.setUnboundAt(null);
        entity.setFarmId(device == null ? null : device.getFarmId());
        if (created) {
            if (device == null) {
                entity.setRemark("建立绑定时的设备标识不在本服务台账内：" + rawDeviceId);
            }
            bindingMapper.insert(entity);
        } else {
            bindingMapper.updateById(entity);
        }
        log.info("设备绑定{}：{}（{} → {}）", created ? "建立" : "更新", entity.getBindingId(), deviceId, targetId);
        // 绑定到地块时把归属回写到物联网端，保证两边看到的设备归属是同一个
        if ("PLOT".equals(bindType)) {
            syncPlotToIot(device, targetId, payload.targetName());
        }
        return IotBindingVO.of(entity);
    }

    /**
     * 把「设备绑定到地块」的结果回写物联网端的 {@code iot_device.plot_id}。
     *
     * <p>绑定关系的权威仍在本地 {@code agri_prod_iot_binding}（它支持大棚、解绑历史、
     * 采集频率，物联网端只有一个 plot_id 单列），但归属必须让物联网端也能看到 ——
     * 否则物联网系统的设备详情里永远显示"未分配地块"。</p>
     *
     * <p>回写失败不阻断绑定：绑定本身已经落库，回写只是同步动作，
     * 失败时留日志由后续重试或人工订正。</p>
     */
    private void syncPlotToIot(IoTDevice device, String bindTargetId, String targetName) {
        if (device == null || device.getId() == null) {
            return;
        }
        Long plotId = resolveLocalPlotId(bindTargetId, targetName);
        if (plotId == null) {
            log.warn("绑定对象 {} 无法换算成本地地块主键，跳过回写物联网端 plot_id", bindTargetId);
            return;
        }
        Map<String, Object> body = new HashMap<>();
        body.put("plotId", plotId);
        try {
            iotDeviceClient.updateDevice(TenantContextService.currentAuthorization(), device.getId(), body);
            log.info("已回写物联网端 plot_id：设备 {} → 地块 {}", device.getId(), plotId);
        } catch (RuntimeException e) {
            log.warn("回写物联网端 plot_id 失败（设备 {}）：{}", device.getId(), e.getMessage());
        }
    }

    /**
     * 把绑定对象标识换算成本地地块主键。
     *
     * <p>页面新建绑定写的是本地数字 id，历史演示数据写的是平台标识（{@code DEMO-PLOT-001}），
     * 而地块表的编码是 {@code DEMO-PLOTC-001}（多一个 C），两者对不上。
     * 所以数字直接采用，平台标识只能退化成按地块名称反查。</p>
     */
    private Long resolveLocalPlotId(String bindTargetId, String targetName) {
        String text = blankToNull(bindTargetId);
        if (text == null) {
            return null;
        }
        if (text.chars().allMatch(Character::isDigit)) {
            try {
                return Long.valueOf(text);
            } catch (NumberFormatException ignored) {
                // 超长数字，落到名称反查
            }
        }
        String name = blankToNull(targetName);
        if (name == null) {
            return null;
        }
        try {
            List<Long> ids = jdbc.queryForList(
                    "SELECT id FROM agri_prod_plot_info WHERE deleted=0 AND plot_name=? LIMIT 1",
                    Long.class, name);
            return ids.isEmpty() ? null : ids.get(0);
        } catch (RuntimeException e) {
            log.warn("按名称反查地块失败（{}）：{}", name, e.getMessage());
            return null;
        }
    }

    /**
     * 解绑后，如果该设备已经没有其他生效中的地块绑定，就把物联网端的 {@code plot_id} 清空。
     */
    private void releasePlotIfLast(IotBinding binding) {
        if (!"PLOT".equals(binding.getBindType())) {
            return;
        }
        Long deviceId = longValue(binding.getDeviceId());
        if (deviceId == null) {
            return;
        }
        Long remaining = bindingMapper.selectCount(new LambdaQueryWrapper<IotBinding>()
                .eq(IotBinding::getDeviceId, binding.getDeviceId())
                .eq(IotBinding::getBindType, "PLOT")
                .eq(IotBinding::getStatus, "BOUND"));
        if (remaining != null && remaining > 0) {
            return;
        }
        Map<String, Object> body = new HashMap<>();
        body.put("plotId", null);
        try {
            iotDeviceClient.updateDevice(TenantContextService.currentAuthorization(), deviceId, body);
            log.info("已解除物联网端 plot_id：设备 {}", deviceId);
        } catch (RuntimeException e) {
            log.warn("解除物联网端 plot_id 失败（设备 {}）：{}", deviceId, e.getMessage());
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IotBindingVO unbind(String tenantId, String bindingId) {
        requireTenant(tenantId);
        IotBinding entity = requireBinding(tenantId, bindingId);
        entity.setStatus("UNBOUND");
        entity.setUnboundAt(LocalDateTime.now());
        bindingMapper.updateById(entity);
        log.info("设备解绑：{}（{}）", entity.getBindingId(), entity.getDeviceId());
        releasePlotIfLast(entity);
        return IotBindingVO.of(entity);
    }

    private IotBinding requireBinding(String tenantId, String bindingId) {
        String id = requireText(bindingId, "绑定编号", 64);
        IotBinding entity = bindingMapper.selectOne(new LambdaQueryWrapper<IotBinding>()
                .eq(IotBinding::getTenantId, tenantId)
                .eq(IotBinding::getBindingId, id)
                .last("LIMIT 1"));
        if (entity == null) {
            throw new BusinessException(404, "绑定关系不存在：" + id);
        }
        return entity;
    }

    /* ==================== 指令 ==================== */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IotCommandVO sendCommand(String tenantId, String deviceId, String commandType,
                                    String params, String operator) {
        requireTenant(tenantId);
        String rawDeviceId = requireText(deviceId, "设备标识", 64);
        String type = requireText(commandType, "指令类型", 64);
        IoTDevice device = resolveDevice(tenantId, rawDeviceId);
        if (device == null) {
            // 指令记录挂在设备上，设备不在台账里就无法定位"给谁下的指令"。这里报 404 而不是
            // 硬写一条陌生标识：写进去之后没人能把它和设备对上，只会变成一条查不出所以然的记录。
            throw new BusinessException(404, "设备不在本服务台账，无法记录指令：" + rawDeviceId);
        }
        IotCommand entity = new IotCommand();
        entity.setCommandId("CMMD" + LocalDateTime.now().format(ID_FORMAT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
        entity.setDeviceId(String.valueOf(device.getId()));
        entity.setDeviceCode(device.getDeviceCode());
        entity.setCommandType(type);
        entity.setParams(blankToNull(params));
        entity.setOperator(blankToNull(operator));
        // 只记录、不真下发：状态固定 ISSUED，回执写明未送达。接入真实通道后由通道回执推进状态。
        entity.setStatus(COMMAND_ISSUED);
        entity.setReceipt(RECEIPT_NOT_DELIVERED);
        entity.setSendAt(LocalDateTime.now());
        entity.setReceiptAt(null);
        entity.setTenantId(tenantId);
        entity.setFarmId(device.getFarmId());
        commandMapper.insert(entity);
        log.info("设备指令已记录（未下发）：{} / {} / {}", entity.getCommandId(), device.getDeviceCode(), type);
        return IotCommandVO.of(entity);
    }

    @Override
    public List<IotCommandVO> listCommands(String tenantId, String deviceId, String status, Integer limit) {
        requireTenant(tenantId);
        String rawDeviceId = requireText(deviceId, "设备标识", 64);
        IoTDevice device = resolveDevice(tenantId, rawDeviceId);
        LambdaQueryWrapper<IotCommand> w = new LambdaQueryWrapper<IotCommand>().eq(IotCommand::getTenantId, tenantId)
                // 换算出本地主键就按本地主键筛，否则按原值筛（历史行可能存的是平台侧标识）
                .eq(IotCommand::getDeviceId, device == null ? rawDeviceId : String.valueOf(device.getId()));
        String statusFilter = blankToNull(status);
        if (statusFilter != null) {
            w.eq(IotCommand::getStatus, statusFilter.toUpperCase(Locale.ROOT));
        }
        w.orderByDesc(IotCommand::getSendAt).orderByDesc(IotCommand::getCommandId)
                .last("LIMIT " + clampLimit(limit));
        return commandMapper.selectList(w).stream().map(IotCommandVO::of).toList();
    }

    /* ==================== 心跳 ==================== */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IotDeviceVO heartbeat(String tenantId, String deviceId) {
        requireTenant(tenantId);
        String rawDeviceId = requireText(deviceId, "设备标识", 64);
        IoTDevice device = resolveDevice(tenantId, rawDeviceId);
        if (device == null) {
            throw new BusinessException(404, "设备不在本服务台账，无法记录心跳：" + rawDeviceId);
        }
        LocalDateTime now = LocalDateTime.now();
        device.setStatus("online");
        device.setLastOnlineTime(now);
        device.setUpdateTime(now);
        deviceMapper.updateById(device);
        log.info("设备心跳：{}（{}）", device.getDeviceCode(), DATETIME.format(now));
        return IotDeviceVO.of(device);
    }

    /* ==================== 维修 ==================== */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public IotMaintenanceVO createMaintenance(String tenantId, String deviceId, MaintenancePayload payload) {
        requireTenant(tenantId);
        if (payload == null) {
            throw new BusinessException(400, "请求体不能为空");
        }
        String rawDeviceId = requireText(deviceId, "设备标识", 64);
        IoTDevice device = resolveDevice(tenantId, rawDeviceId);
        if (device == null) {
            throw new BusinessException(404, "设备不在本服务台账，无法登记维修记录：" + rawDeviceId);
        }
        String content = requireText(payload.content(), "维修内容", 1000);
        String maintainType = blankToNull(payload.maintainType());
        if (maintainType != null) {
            maintainType = maintainType.toUpperCase(Locale.ROOT);
            if (!MAINTAIN_TYPES.contains(maintainType)) {
                throw new BusinessException(400, "维修类型应为 " + MAINTAIN_TYPES + "：" + payload.maintainType());
            }
        }
        IotMaintenance entity = new IotMaintenance();
        entity.setMaintainId("MNTN" + LocalDateTime.now().format(ID_FORMAT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
        entity.setDeviceId(String.valueOf(device.getId()));
        entity.setDeviceCode(device.getDeviceCode());
        entity.setMaintainType(maintainType);
        entity.setContent(content);
        entity.setOperator(blankToNull(payload.operator()));
        // 不传维修时间就取当下（页面契约如此），而不是留空 —— 维修记录没有时间就失去意义
        entity.setMaintainAt(parseDateTime(payload.maintainAt(), "maintainAt", LocalDateTime.now()));
        entity.setResult(blankToNull(payload.result()));
        entity.setNextMaintainAt(parseDateTime(payload.nextMaintainAt(), "nextMaintainAt", null));
        entity.setTenantId(tenantId);
        entity.setFarmId(device.getFarmId());
        maintenanceMapper.insert(entity);
        log.info("设备维修登记：{}（{} / {}）", entity.getMaintainId(), device.getDeviceCode(), maintainType);
        return IotMaintenanceVO.of(entity);
    }

    @Override
    public List<IotMaintenanceVO> listMaintenances(String tenantId, String deviceId, Integer limit) {
        requireTenant(tenantId);
        String rawDeviceId = requireText(deviceId, "设备标识", 64);
        IoTDevice device = resolveDevice(tenantId, rawDeviceId);
        LambdaQueryWrapper<IotMaintenance> w = new LambdaQueryWrapper<IotMaintenance>()
                .eq(IotMaintenance::getTenantId, tenantId)
                .eq(IotMaintenance::getDeviceId, device == null ? rawDeviceId : String.valueOf(device.getId()))
                .orderByDesc(IotMaintenance::getMaintainAt)
                .orderByDesc(IotMaintenance::getMaintainId)
                .last("LIMIT " + clampLimit(limit));
        return maintenanceMapper.selectList(w).stream().map(IotMaintenanceVO::of).toList();
    }

    /* ==================== 内部工具 ==================== */

    /**
     * 设备标识 → 本服务设备行。
     *
     * <p>接受三类写法：本地数字主键、设备编码（DEV001）、平台侧标识（DEMO-DEV-001，靠
     * platform_device_id 这一列换算 —— 与农场表的 platform_farm_id 同法）。认不出来返回 null，
     * 由调用方决定是"报 404"还是"按原值存"。**只有设备主键与主数据收敛在同一个库时，这种换算才成立。**</p>
     */
    private IoTDevice resolveDevice(String tenantId, String raw) {
        String text = blankToNull(raw);
        if (text == null) {
            return null;
        }
        // 设备台账已收敛到物联网系统，优先按那边查；查不到再回退本地历史副本
        IoTDevice fromIot = resolveFromIot(text);
        if (fromIot != null) {
            return fromIot;
        }
        if (text.chars().allMatch(Character::isDigit)) {
            try {
                IoTDevice device = deviceMapper.selectById(Long.valueOf(text));
                return device != null && tenantId.equals(device.getTenantId()) ? device : null;
            } catch (NumberFormatException e) {
                // 超长数字：落到编码/平台标识匹配
            }
        }
        return deviceMapper.selectOne(new LambdaQueryWrapper<IoTDevice>()
                .eq(IoTDevice::getTenantId, tenantId)
                .and(w -> w.eq(IoTDevice::getDeviceCode, text).or().eq(IoTDevice::getPlatformDeviceId, text))
                .last("LIMIT 1"));
    }

    /**
     * 从物联网系统解析设备，构造一个<b>不落库的影子对象</b>供上层取 id/编码/名称/农场。
     *
     * <p>影子对象的 {@code tenantId} 故意留空：它不代表本地台账里的行，
     * 后续若有人对它执行 {@code updateById}，条件命中的只会是同 id 的历史副本（已废弃），
     * 不会污染真实数据。</p>
     */
    private IoTDevice resolveFromIot(String raw) {
        String authorization = TenantContextService.currentAuthorization();
        if (authorization == null || authorization.isBlank()) {
            return null;
        }
        try {
            Map<String, Object> row = null;
            if (raw.chars().allMatch(Character::isDigit)) {
                try {
                    row = iotDeviceClient.getDevice(authorization, Long.parseLong(raw));
                } catch (RuntimeException ignored) {
                    // 数字 id 在物联网端不存在时继续按编码找
                }
            }
            if (row == null) {
                List<Map<String, Object>> list = iotDeviceClient.listDevices(
                        authorization, Map.of("keyword", raw));
                row = list.stream()
                        .filter(item -> raw.equalsIgnoreCase(String.valueOf(item.get("deviceCode"))))
                        .findFirst()
                        .orElse(null);
            }
            if (row == null) {
                return null;
            }
            IoTDevice shadow = new IoTDevice();
            shadow.setId(longValue(row.get("id")));
            shadow.setDeviceCode(str(row.get("deviceCode")));
            shadow.setDeviceName(str(row.get("deviceName")));
            shadow.setFarmId(longValue(row.get("farmId")));
            return shadow;
        } catch (RuntimeException e) {
            log.warn("查询物联网设备失败，回退本地台账：{}", e.getMessage());
            return null;
        }
    }

    private static Long longValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static int clampLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return LIMIT_DEFAULT;
        }
        return Math.min(limit, LIMIT_MAX);
    }

    private static LocalDateTime parseDateTime(String text, String field, LocalDateTime fallback) {
        String raw = blankToNull(text);
        if (raw == null) {
            return fallback;
        }
        String normalized = raw.replace('T', ' ');
        if (normalized.length() == 10) {
            normalized = normalized + " 00:00:00";
        }
        // 允许 "yyyy-MM-dd HH:mm" 这类缺秒的写法：补上 ":00" 再解析，省得调用方为此报错
        if (normalized.length() == 16) {
            normalized = normalized + ":00";
        }
        try {
            return LocalDateTime.parse(normalized, DATETIME);
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + " 格式应为 yyyy-MM-dd HH:mm:ss：" + raw);
        }
    }

    private static void requireTenant(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法操作 IoT 数据");
        }
    }

    private static String requireText(String value, String field, int maxLength) {
        String text = blankToNull(value);
        if (text == null) {
            throw new BusinessException(400, field + "为必填");
        }
        if (text.length() > maxLength) {
            throw new BusinessException(400, field + "不得超过 " + maxLength + " 字");
        }
        return text;
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
