package com.agri.production.vo;

import com.agri.production.entity.IotMaintenance;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/** 维修记录出参（页面 IotMaintenance）。 */
@Data
public class IotMaintenanceVO {

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String maintainId;
    private String deviceId;
    private String deviceCode;
    /** INSPECT / REPAIR / REPLACE / CALIBRATE / UPGRADE */
    private String maintainType;
    private String content;
    private String operator;
    private String maintainAt;
    private String result;
    /** 下次保养日期（页面暂无此字段） */
    private String nextMaintainAt;

    public static IotMaintenanceVO of(IotMaintenance entity) {
        if (entity == null) {
            return null;
        }
        IotMaintenanceVO vo = new IotMaintenanceVO();
        vo.maintainId = entity.getMaintainId();
        vo.deviceId = entity.getDeviceId();
        vo.deviceCode = entity.getDeviceCode();
        vo.maintainType = entity.getMaintainType();
        vo.content = entity.getContent();
        vo.operator = entity.getOperator();
        vo.maintainAt = entity.getMaintainAt() == null ? null : DATETIME.format(entity.getMaintainAt());
        vo.result = entity.getResult();
        vo.nextMaintainAt = entity.getNextMaintainAt() == null ? null
                : DATETIME.format(entity.getNextMaintainAt());
        return vo;
    }
}
