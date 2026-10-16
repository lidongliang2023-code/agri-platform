package com.agri.production.vo;

import com.agri.production.entity.IotCommand;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 指令出参（页面 IotCommand）。
 *
 * <p>响应里额外带 {@code delivery}：本部署没有下发通道，该字段恒为 {@code record-only}，
 * 与回执文案一起让"指令只被记录、没有真的送达"这件事在接口层就看得见。</p>
 */
@Data
public class IotCommandVO {

    /** 本部署未接设备下发通道（固定值） */
    public static final String DELIVERY_RECORD_ONLY = "record-only";

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String commandId;
    private String deviceId;
    private String deviceCode;
    private String commandType;
    private String params;
    private String operator;
    /** ISSUED（本部署）/ PENDING / SUCCESS / FAILED */
    private String status;
    private String receipt;
    private String sendAt;
    private String receiptAt;
    /** 固定 record-only */
    private String delivery;

    public static IotCommandVO of(IotCommand entity) {
        if (entity == null) {
            return null;
        }
        IotCommandVO vo = new IotCommandVO();
        vo.commandId = entity.getCommandId();
        vo.deviceId = entity.getDeviceId();
        vo.deviceCode = entity.getDeviceCode();
        vo.commandType = entity.getCommandType();
        vo.params = entity.getParams();
        vo.operator = entity.getOperator();
        vo.status = entity.getStatus();
        vo.receipt = entity.getReceipt();
        vo.sendAt = entity.getSendAt() == null ? null : DATETIME.format(entity.getSendAt());
        vo.receiptAt = entity.getReceiptAt() == null ? null : DATETIME.format(entity.getReceiptAt());
        vo.delivery = DELIVERY_RECORD_ONLY;
        return vo;
    }
}
