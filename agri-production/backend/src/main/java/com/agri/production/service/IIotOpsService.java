package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.IotBindingVO;
import com.agri.production.vo.IotCommandVO;
import com.agri.production.vo.IotDeviceVO;
import com.agri.production.vo.IotMaintenanceVO;

import java.util.List;

/**
 * IoT 设备运维（绑定 / 指令 / 维修 / 心跳）：{@code /api/v1/production/iot/**} 里本服务负责的那部分。
 *
 * <p>与 {@code IIoTService}（设备台账与传感器读数）分开是刻意的：那一份是在途文件里的旧实现，
 * 这一份是本轮新加的运维域，混在一起改容易把两种口径搅在一块。</p>
 */
public interface IIotOpsService {

    /**
     * 绑定关系列表。
     *
     * <p>{@code status} 不传时**只返回 BOUND**（与前端契约注释一致：页面默认看"已绑定的"）；
     * 传 {@code ALL} 返回全部（供核账/运营端用）。</p>
     */
    List<IotBindingVO> listBindings(String tenantId, BindingQuery query);

    /** 绑定关系分页（页面「设备绑定」列表走这条）。 */
    PageResult<IotBindingVO> pageBindings(String tenantId, int pageNum, int pageSize, BindingQuery query);

    /**
     * 建立绑定（同「设备 + 类型 + 对象」重复绑定时为 upsert：重新置为 BOUND）。
     *
     * @throws com.agri.production.common.exception.BusinessException 设备标识/绑定类型缺失或非法（400）
     */
    IotBindingVO bind(String tenantId, BindPayload payload);

    /**
     * 解绑（记录保留，状态置 UNBOUND 并写解绑时间）。
     *
     * @throws com.agri.production.common.exception.BusinessException 绑定不存在（404）
     */
    IotBindingVO unbind(String tenantId, String bindingId);

    /**
     * 记录一条设备指令。

     *
     * <p><b>本部署没有下发通道</b>：只落库、状态固定 ISSUED，响应与回执里都写明"未实际下发"。</p>
     */
    IotCommandVO sendCommand(String tenantId, String deviceId, String commandType, String params, String operator);

    /** 某设备的指令记录（按下发时间倒序）。 */
    List<IotCommandVO> listCommands(String tenantId, String deviceId, String status, Integer limit);

    /**
     * 设备心跳：把最近在线时间置为当下、状态置在线。
     *
     * @throws com.agri.production.common.exception.BusinessException 设备不在本服务台账（404）
     */
    IotDeviceVO heartbeat(String tenantId, String deviceId);

    /**
     * 登记维修/保养记录。
     *
     * @throws com.agri.production.common.exception.BusinessException 参数非法（400）
     */
    IotMaintenanceVO createMaintenance(String tenantId, String deviceId, MaintenancePayload payload);

    /** 某设备的维修记录（按维修时间倒序）。 */
    List<IotMaintenanceVO> listMaintenances(String tenantId, String deviceId, Integer limit);

    /**
     * 绑定关系查询条件。
     *
     * @param deviceId     设备标识，可为空
     * @param bindType     PLOT / GREENHOUSE / FARM，可为空
     * @param bindTargetId 绑定对象标识，可为空
     * @param status       BOUND / UNBOUND / PAUSED / ALL，可为空（缺省只返回 BOUND）
     */
    record BindingQuery(String deviceId, String bindType, String bindTargetId, String status) {
    }

    /**
     * 建立绑定入参（页面以 query 参数发送）。
     *
     * @param deviceId     设备标识（本地主键 / 设备编码 / 平台侧标识）
     * @param bindType     PLOT / GREENHOUSE / FARM
     * @param bindTargetId 绑定对象标识
     * @param targetName   绑定对象名称（页面回传，落库冗余）
     * @param metrics      采集指标（逗号分隔或数组，服务端统一存逗号串）
     * @param frequency    采集频率（分钟）
     */
    record BindPayload(String deviceId, String bindType, String bindTargetId, String targetName,
                       List<String> metrics, Integer frequency) {
    }

    /**
     * 维修记录入参。
     *
     * @param maintainType   INSPECT / REPAIR / REPLACE / CALIBRATE / UPGRADE
     * @param content        维修内容
     * @param operator       操作人
     * @param maintainAt     维修时间（yyyy-MM-dd HH:mm:ss；不传取当前时间）
     * @param result         维修结果
     * @param nextMaintainAt 下次保养日期（页面暂无此字段）
     */
    record MaintenancePayload(String maintainType, String content, String operator, String maintainAt,
                              String result, String nextMaintainAt) {
    }
}
