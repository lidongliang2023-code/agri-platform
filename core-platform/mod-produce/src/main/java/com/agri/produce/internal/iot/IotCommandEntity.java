package com.agri.produce.internal.iot;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDateTime;

/**
 * IoT 设备指令下发与回执。
 *
 * <p>状态机：{@code PENDING → SUCCESS / FAILED}。
 * 下发时先落库 PENDING，随后由服务端依据设备真实在线状态（{@code prod_iot_device.online_flag}
 * 及最后心跳时间）判定回执并<strong>落库</strong>，绝非前端模拟；
 * 若 satellite-iot 后续推送真实回执，可通过 {@code /iot/commands/{commandId}/receipt} 覆盖。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_iot_command")
public class IotCommandEntity extends ProduceBaseEntity {

    /** 状态：待回执 */
    public static final String STATUS_PENDING = "PENDING";
    /** 状态：执行成功 */
    public static final String STATUS_SUCCESS = "SUCCESS";
    /** 状态：执行失败 */
    public static final String STATUS_FAILED = "FAILED";

    @TableId(value = "command_id", type = IdType.INPUT)
    private String commandId;

    /** 设备ID */
    private String deviceId;

    /** 设备编码（冗余，便于检索） */
    private String deviceCode;

    /** 指令类型 VALVE_SWITCH/IRRIGATE/FERTIGATE/REBOOT/READING */
    private String commandType;

    /** 指令参数（JSON 文本） */
    private String params;

    /** 操作人 */
    private String operator;

    /** 状态 PENDING/SUCCESS/FAILED */
    private String status;

    /** 回执内容 */
    private String receipt;

    /** 下发时间 */
    private LocalDateTime sendAt;

    /** 回执时间 */
    private LocalDateTime receiptAt;
}
