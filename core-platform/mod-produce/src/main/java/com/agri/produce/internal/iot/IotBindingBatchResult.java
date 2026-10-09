package com.agri.produce.internal.iot;

import lombok.Data;

/**
 * 批量绑定单项结果。
 *
 * <p>运营端一次可能绑定几十台设备，若因第 N 台重复就把前 N-1 台一起作废是不可接受的，
 * 故批量接口<strong>逐条给出结果</strong>：成功带 {@code bindingId}，失败带 {@code reason}，
 * 前端可逐行展示「哪台成了、哪台为什么没成」。</p>
 */
@Data
public class IotBindingBatchResult {

    /** 设备业务主键 */
    private String deviceId;

    /** 是否绑定成功 */
    private boolean success;

    /** 成功时的绑定关系业务主键；失败为 null */
    private String bindingId;

    /** 失败原因；成功为 null */
    private String reason;

    /**
     * 构造成功结果。
     *
     * @param deviceId  设备业务主键
     * @param bindingId 绑定关系业务主键
     * @return 结果对象
     */
    public static IotBindingBatchResult ok(String deviceId, String bindingId) {
        IotBindingBatchResult result = new IotBindingBatchResult();
        result.setDeviceId(deviceId);
        result.setSuccess(true);
        result.setBindingId(bindingId);
        result.setReason(null);
        return result;
    }

    /**
     * 构造失败结果。
     *
     * @param deviceId 设备业务主键
     * @param reason   失败原因
     * @return 结果对象
     */
    public static IotBindingBatchResult fail(String deviceId, String reason) {
        IotBindingBatchResult result = new IotBindingBatchResult();
        result.setDeviceId(deviceId);
        result.setSuccess(false);
        result.setBindingId(null);
        result.setReason(reason);
        return result;
    }
}
