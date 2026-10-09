package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * IoT 指令下发与回执 应用服务。
 *
 * <p><b>回执是服务端落库的真实状态</b>：下发时先落 {@code PENDING}，
 * 随即按设备真实在线状态（{@code online_flag} 与最后心跳新鲜度）判定
 * {@code SUCCESS}/{@code FAILED} 并写入 receipt / receipt_at 持久化；
 * 若卫星服务后续推送真实回执，可通过 {@link #receipt(String, boolean, String)} 覆盖。</p>
 */
@Service
@RequiredArgsConstructor
public class IotCommandService {

    private static final String ID_PREFIX = "CMMD";

    /**
     * 心跳有效窗口（分钟）：超过该窗口视为离线，指令送达失败。
     *
     * <p>复用 {@link IotDeviceService#HEARTBEAT_VALID_MINUTES}，保证「指令送达判定」
     * 与「列表在线/离线筛选」口径一致，不各自漂移。</p>
     */
    private static final long HEARTBEAT_VALID_MINUTES = IotDeviceService.HEARTBEAT_VALID_MINUTES;

    private static final String RECEIPT_ONLINE = "设备在线，指令已送达";
    private static final String RECEIPT_OFFLINE = "送达失败：设备离线或无有效心跳";

    private final IotCommandMapper iotCommandMapper;
    private final IotDeviceService iotDeviceService;

    /**
     * 指令下发：落库 PENDING 后立即按设备真实在线状态判定回执并持久化。
     *
     * @param deviceId    设备业务主键
     * @param commandType 指令类型
     * @param params      指令参数（JSON 文本，可为空）
     * @param operator    操作人
     * @return 已落库的指令（含最终状态与回执）
     */
    @Transactional
    public IotCommandEntity send(String deviceId, String commandType, String params, String operator) {
        IotDeviceEntity device = iotDeviceService.detail(deviceId);

        IotCommandEntity command = new IotCommandEntity();
        command.setCommandId(ProduceIds.newId(ID_PREFIX));
        command.setDeviceId(device.getDeviceId());
        command.setDeviceCode(device.getDeviceCode());
        command.setCommandType(commandType);
        command.setParams(params);
        command.setOperator(operator);
        command.setStatus(IotCommandEntity.STATUS_PENDING);
        command.setSendAt(LocalDateTime.now());
        iotCommandMapper.insert(command);

        // 服务端真实判定：设备在线且心跳新鲜 → 送达成功，否则送达失败
        boolean online = isOnline(device);
        command.setStatus(online ? IotCommandEntity.STATUS_SUCCESS : IotCommandEntity.STATUS_FAILED);
        command.setReceipt(online ? RECEIPT_ONLINE : RECEIPT_OFFLINE);
        command.setReceiptAt(LocalDateTime.now());
        iotCommandMapper.updateById(command);
        return command;
    }

    /**
     * 设备真实回执回调（satellite-iot 推送时调用），覆盖服务端预判结果。
     *
     * @param commandId 指令业务主键
     * @param success   是否执行成功
     * @param receipt   回执内容
     * @return 更新后的指令
     */
    @Transactional
    public IotCommandEntity receipt(String commandId, boolean success, String receipt) {
        IotCommandEntity command = detail(commandId);
        command.setStatus(success ? IotCommandEntity.STATUS_SUCCESS : IotCommandEntity.STATUS_FAILED);
        command.setReceipt(receipt == null || receipt.isBlank()
                ? (success ? RECEIPT_ONLINE : RECEIPT_OFFLINE) : receipt);
        command.setReceiptAt(LocalDateTime.now());
        iotCommandMapper.updateById(command);
        return command;
    }

    /**
     * 指令详情，不存在抛 NOT_FOUND。
     *
     * @param commandId 指令业务主键
     * @return 指令实体
     */
    public IotCommandEntity detail(String commandId) {
        IotCommandEntity command = iotCommandMapper.selectById(commandId);
        if (command == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return command;
    }

    /**
     * 指定设备的指令记录（按下发时间倒序）。
     *
     * @param deviceId 设备业务主键
     * @param status   状态过滤，可为空
     * @param limit    返回条数上限，默认 100
     * @return 指令列表
     */
    public List<IotCommandEntity> listByDevice(String deviceId, String status, Integer limit) {
        int max = (limit == null || limit <= 0) ? 100 : Math.min(limit, 500);
        return iotCommandMapper.selectList(new LambdaQueryWrapper<IotCommandEntity>()
                .eq(IotCommandEntity::getDeviceId, deviceId)
                .eq(status != null && !status.isBlank(), IotCommandEntity::getStatus, status)
                .orderByDesc(IotCommandEntity::getSendAt)
                .last("LIMIT " + max));
    }

    /**
     * 指令分页查询。
     *
     * @param deviceId 设备业务主键，可为空
     * @param status   状态过滤，可为空
     * @return 分页结果
     */
    public PageResult<IotCommandEntity> page(long page, long size, String deviceId, String status) {
        Page<IotCommandEntity> result = iotCommandMapper.selectPage(new Page<>(page, size),
                        new LambdaQueryWrapper<IotCommandEntity>()
                                .eq(deviceId != null && !deviceId.isBlank(),
                                        IotCommandEntity::getDeviceId, deviceId)
                                .eq(status != null && !status.isBlank(),
                                        IotCommandEntity::getStatus, status)
                                .orderByDesc(IotCommandEntity::getSendAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 判断设备是否处于有效在线状态。
     *
     * @param device 设备实体
     * @return true 表示在线且心跳新鲜
     */
    private boolean isOnline(IotDeviceEntity device) {
        if (device.getOnlineFlag() == null || device.getOnlineFlag() != 1) {
            return false;
        }
        LocalDateTime lastHeartbeat = device.getLastHeartbeatAt();
        if (lastHeartbeat == null) {
            return false;
        }
        return !lastHeartbeat.isBefore(LocalDateTime.now().minusMinutes(HEARTBEAT_VALID_MINUTES));
    }
}
