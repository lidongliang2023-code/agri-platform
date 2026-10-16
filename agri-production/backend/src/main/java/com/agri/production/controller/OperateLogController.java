package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.OperateLog;
import com.agri.production.mapper.OperateLogMapper;
import com.agri.production.service.TenantContextService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.Data;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 操作日志（页面「系统设置 → 操作日志」，{@code GET /settings/logs}）。

 *
 * <p>出参按页面 {@code OperationLogItem}：{@code logId / operateTime / operator / operateType / target /
 * result(1 成功 0 失败) / ipAddress}；分页用本服务的 PageResult，页面侧的响应归一化会把它转成 {@code list}。</p>
 */
@RestController
@RequestMapping("/api/v1/production/settings")
public class OperateLogController {

    private final OperateLogMapper logMapper;

    public OperateLogController(OperateLogMapper logMapper) {
        this.logMapper = logMapper;
    }

    /** 操作日志分页（支持 operateType / operator 过滤）。 */
    @GetMapping("/logs")
    public ApiResponse<PageResult<OperateLogVO>> logs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String operateType,
            @RequestParam(required = false) String operator) {
        String tenantId = TenantContextService.currentTenantId();
        int p = firstNonNull(pageNum, page, 1);
        int s = firstNonNull(pageSize, size, 10);
        LambdaQueryWrapper<OperateLog> w = new LambdaQueryWrapper<OperateLog>().eq(OperateLog::getTenantId, tenantId);
        if (operateType != null && !operateType.isBlank()) {
            w.like(OperateLog::getOperateType, operateType.trim());
        }
        if (operator != null && !operator.isBlank()) {
            w.like(OperateLog::getOperator, operator.trim());
        }
        w.orderByDesc(OperateLog::getOperateAt).orderByDesc(OperateLog::getId);
        Page<OperateLog> page1 = logMapper.selectPage(new Page<>(p, s), w);
        List<OperateLogVO> rows = page1.getRecords().stream().map(OperateLogVO::of).toList();
        return ApiResponse.success(PageResult.of(rows, page1.getTotal(), p, s));
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }

    /** 操作日志出参（页面 OperationLogItem）。 */
    @Data
    public static class OperateLogVO {

        private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

        private String logId;
        /** yyyy-MM-dd HH:mm:ss */
        private String operateTime;
        private String operator;
        private String operateType;
        private String target;
        /** 1 成功 0 失败 */
        private Integer result;
        private String ipAddress;
        /** 业务结果码与耗时：页面暂不显示，排查"为什么记成失败"时要知道 */
        private Integer businessCode;
        private Long costMs;
        private String detail;

        static OperateLogVO of(OperateLog entity) {
            OperateLogVO vo = new OperateLogVO();
            vo.logId = entity.getLogId();
            vo.operateTime = entity.getOperateAt() == null ? null : DATETIME.format(entity.getOperateAt());
            vo.operator = entity.getOperator();
            vo.operateType = entity.getOperateType();
            vo.target = entity.getTarget();
            vo.result = entity.getResult();
            vo.ipAddress = entity.getIpAddress();
            vo.businessCode = entity.getBusinessCode();
            vo.costMs = entity.getCostMs();
            vo.detail = entity.getDetail();
            return vo;
        }
    }
}
