package com.agri.produce.internal.admin;

import com.agri.produce.internal.iot.IotBindingBatchResult;
import com.agri.produce.internal.iot.IotBindingService;
import com.agri.produce.internal.iot.IotBindingVO;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 运营端 IoT 管理能力（批量绑定等）。
 *
 * <p>用户端绑定能力在 {@code /api/v1/production/iot/bindings}；此处承载运营端专属的
 * 批量作业，避免把运营动作塞进用户端控制器。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/iot")
@RequiredArgsConstructor
public class AdminIotController {

    private final IotBindingService iotBindingService;

    /**
     * 批量绑定：把多个设备一次绑定到同一个对象（地块/大棚/农场）。
     *
     * <p>整批走一个事务，逐条复用与单条绑定完全相同的校验（设备存在性 + 目标存在性 + 唯一键），
     * 逐条返回结果。<strong>单条失败不影响其余条目</strong>——运营一次绑 20 台，
     * 不会因为第 17 台重复就把前 16 台一起作废。</p>
     *
     * @param bindType     绑定对象类型 PLOT/GREENHOUSE/FARM
     * @param bindTargetId 绑定对象ID
     * @param deviceIds    设备业务主键列表
     * @param targetName   绑定对象名称，可为空（缺省回退为对象ID）
     * @param metrics      采集指标，逗号分隔，可为空
     * @param frequency    采集频率（分钟），可为空
     * @return 逐条结果：{@code deviceId / success / bindingId / reason}
     */
    @PostMapping("/bindings/batch")
    public ApiResponse<List<IotBindingBatchResult>> batchBind(
            @RequestParam(defaultValue = "PLOT") String bindType,
            @RequestParam String bindTargetId,
            @RequestParam List<String> deviceIds,
            @RequestParam(required = false) String targetName,
            @RequestParam(required = false) String metrics,
            @RequestParam(required = false) Integer frequency) {
        return ApiResponse.ok(iotBindingService.batchBind(
                bindType, bindTargetId, deviceIds, targetName, metrics, frequency));
    }

    /**
     * 运营端绑定关系分页查询（跨设备/跨对象）。
     *
     * @param page     页码，默认 1
     * @param size     每页条数，默认 10
     * @param deviceId 设备业务主键，可为空
     * @param bindType 绑定对象类型，可为空
     * @param status   状态过滤，可为空
     * @return 绑定关系分页结果
     */
    @GetMapping("/bindings")
    public ApiResponse<PageResult<IotBindingVO>> pageBindings(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String bindType,
            @RequestParam(required = false) String status) {
        return ApiResponse.ok(iotBindingService.page(page, size, deviceId, bindType, status));
    }
}
