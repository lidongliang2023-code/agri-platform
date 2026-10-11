package com.agri.produce.internal.admin.foodsafety;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;

/**
 * 运营端：流通异常检测（P16）。
 *
 * <p>筛选条件一律<strong>可选</strong>：{@code all} 与空值同样视为「不筛选」——
 * 列表接口强制要求筛选条件会迫使调用方绕过条件取数，反而丢数据。</p>
 */
@Service
@RequiredArgsConstructor
public class AdminFoodSafetyCirculationService {

    private static final String FILTER_ALL = "all";
    private static final String ACTION_CLOSE = "关闭";
    private static final String STATUS_DONE = "done";
    private static final String STATUS_PROCESSING = "processing";
    private static final int REMARK_MAX_LENGTH = 200;

    private final CirculationAnomalyMapper circulationAnomalyMapper;

    /**
     * 流通异常分页查询。
     *
     * @param page     页码
     * @param size     每页条数
     * @param type     异常类型筛选（all/空 = 不筛选）
     * @param severity 严重程度筛选（all/空 = 不筛选）
     * @param date     发现日期筛选 {@code yyyy-MM-dd}（空 = 不限制日期）
     * @param keyword  关键字：模糊匹配异常编号 / 批次号 / 产品
     * @return 分页结果
     */
    public PageResult<CirculationAnomalyEntity> page(long page, long size, String type, String severity,
                                                     String date, String keyword) {
        LocalDate foundDate = parseDate(date);
        Page<CirculationAnomalyEntity> result = circulationAnomalyMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<CirculationAnomalyEntity>()
                        .eq(isEffective(type), CirculationAnomalyEntity::getType, type)
                        .eq(isEffective(severity), CirculationAnomalyEntity::getSeverity, severity)
                        .eq(foundDate != null, CirculationAnomalyEntity::getFoundDate, foundDate)
                        .and(isEffective(keyword), wrapper -> wrapper
                                .like(CirculationAnomalyEntity::getId, keyword)
                                .or().like(CirculationAnomalyEntity::getBatchNo, keyword)
                                .or().like(CirculationAnomalyEntity::getProduct, keyword))
                        .orderByDesc(CirculationAnomalyEntity::getFoundTime));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 处理流通异常（写操作）。
     *
     * @param id      异常编号
     * @param request 处置请求体
     * @return true 表示已落库更新
     */
    @Transactional
    public boolean handle(String id, CirculationHandleRequest request) {
        if (request == null || !isEffective(request.action())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处置方式为必填");
        }
        if (!isEffective(request.remark())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处置说明为必填");
        }
        if (request.remark().trim().length() > REMARK_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处置说明不得超过 200 字");
        }
        CirculationAnomalyEntity anomaly = circulationAnomalyMapper.selectById(id);
        if (anomaly == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "流通异常记录不存在：" + id);
        }
        anomaly.setStatus(ACTION_CLOSE.equals(request.action().trim()) ? STATUS_DONE : STATUS_PROCESSING);
        anomaly.setMeasure(request.action().trim());
        anomaly.setHandleRemark(request.remark().trim());
        anomaly.setHandleTime(LocalDateTime.now());
        return circulationAnomalyMapper.updateById(anomaly) > 0;
    }

    /**
     * 解析发现日期；非法格式直接报参数错误。
     *
     * <p>不静默忽略非法日期：把 {@code 2026-13-01} 当成「不筛选」会让调用方以为筛选生效，
     * 拿到全量数据却以为是当日数据。</p>
     */
    private LocalDate parseDate(String date) {
        if (!isEffective(date)) {
            return null;
        }
        try {
            return LocalDate.parse(date.trim());
        } catch (DateTimeParseException ex) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "发现日期格式应为 yyyy-MM-dd：" + date);
        }
    }

    /** 值是否有效（非空且不等于 all）。 */
    private boolean isEffective(String value) {
        return value != null && !value.isBlank() && !FILTER_ALL.equalsIgnoreCase(value.trim());
    }
}
