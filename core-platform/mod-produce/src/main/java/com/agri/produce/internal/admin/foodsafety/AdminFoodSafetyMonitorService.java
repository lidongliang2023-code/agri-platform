package com.agri.produce.internal.admin.foodsafety;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端：食品安全监控中心（P15）。
 *
 * <p><b>指标口径（8 个字段全部由本模块明细表实时聚合，无快照表、无双数据源）。</b>
 * 「当期」= 库内 {@code prod_fs_farm_risk} 最新统计月，「上期」= 其前一月；
 * 刻意不用系统当前月，否则演示环境跨月后指标会整体归零。</p>
 * <ul>
 *   <li>{@code safetyIndex} = 当期农场风险评分均值（1 位小数）；</li>
 *   <li>{@code safetyIndexDelta} = 当期均值 − 上期均值；</li>
 *   <li>{@code passRate} = 当期标准校验项 pass 占比（%）；</li>
 *   <li>{@code passRateDelta} = 当期 − 上期（百分点）；</li>
 *   <li>{@code alertCount} / {@code urgentAlertCount} = 告警总数 / {@code level='urgent'} 数；</li>
 *   <li>{@code compliancePassRate} = 全部标准 {@code pass_count / batch_count}（批次级，与 P17 Tab3 同源）；</li>
 *   <li>{@code coldChainPassRate} = 冷链资源非离线占比，与 P19 同源。</li>
 * </ul>
 * <p>任一聚合无数据时返回 {@code null}，<strong>不填 0</strong>：0 是「真实为零」的语义，
 * 与「无数据」不是一回事。前端已按 {@code metrics?.x ?? 0} 兜底，null 不会导致页面崩溃。</p>
 */
@Service
@RequiredArgsConstructor
public class AdminFoodSafetyMonitorService {

    private static final String LEVEL_URGENT = "urgent";
    private static final String RESULT_PASS = "pass";
    private static final String RESOURCE_OFFLINE = "offline";
    private static final String STATUS_HANDLED = "已处理";
    private static final int DEFAULT_ALERT_LIMIT = 20;
    private static final int MAX_ALERT_LIMIT = 200;
    private static final int REMARK_MAX_LENGTH = 200;

    private final FoodSafetyAlertMapper alertMapper;
    private final FarmRiskMapper farmRiskMapper;
    private final StandardItemMapper standardItemMapper;
    private final StandardSummaryMapper standardSummaryMapper;
    private final ColdChainResourceMapper coldChainResourceMapper;

    /**
     * 监控中心核心指标。
     *
     * @return 8 个契约字段；无数据的聚合返回 null
     */
    public Map<String, Object> metrics() {
        YearMonth current = latestRiskMonth();
        YearMonth previous = current == null ? null : current.minusMonths(1);

        BigDecimal safetyIndex = farmRiskAverage(current);
        BigDecimal previousSafetyIndex = farmRiskAverage(previous);
        BigDecimal passRate = itemPassRate(current);
        BigDecimal previousPassRate = itemPassRate(previous);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("safetyIndex", safetyIndex);
        result.put("safetyIndexDelta", delta(safetyIndex, previousSafetyIndex));
        result.put("passRate", passRate);
        result.put("passRateDelta", delta(passRate, previousPassRate));
        result.put("alertCount", alertMapper.selectCount(null));
        result.put("urgentAlertCount", alertMapper.selectCount(new LambdaQueryWrapper<FoodSafetyAlertEntity>()
                .eq(FoodSafetyAlertEntity::getLevel, LEVEL_URGENT)));
        result.put("compliancePassRate", compliancePassRate());
        result.put("coldChainPassRate", coldChainPassRate());
        return result;
    }

    /**
     * 当期农场风险评分（前端按 16 条渲染 4×4 热力图，按分数降序取前若干条）。
     *
     * @return 风险评分列表；无当期数据时返回空列表
     */
    public List<FarmRiskEntity> riskDistribution() {
        YearMonth current = latestRiskMonth();
        if (current == null) {
            return List.of();
        }
        return farmRiskMapper.selectList(new LambdaQueryWrapper<FarmRiskEntity>()
                .ge(FarmRiskEntity::getStatDate, current.atDay(1))
                .lt(FarmRiskEntity::getStatDate, current.plusMonths(1).atDay(1))
                .orderByDesc(FarmRiskEntity::getScore));
    }

    /**
     * 食品安全告警列表（按发生时间倒序）。
     *
     * @param limit 返回条数上限，缺省 20，最大 200
     * @return 告警列表
     */
    public List<FoodSafetyAlertEntity> listAlerts(Integer limit) {
        int size = limit == null || limit <= 0 ? DEFAULT_ALERT_LIMIT : Math.min(limit, MAX_ALERT_LIMIT);
        Page<FoodSafetyAlertEntity> page = alertMapper.selectPage(new Page<>(1, size),
                new LambdaQueryWrapper<FoodSafetyAlertEntity>()
                        .orderByDesc(FoodSafetyAlertEntity::getHappenTime));
        return page.getRecords();
    }

    /**
     * 处置食品安全告警（写操作）。
     *
     * <p>处置措施与处置说明都是必填：食品安全属合规强相关场景，
     * 只把状态改成「已处理」而不留处置依据，等于没有可审计的闭环。</p>
     *
     * @param id      告警编号
     * @param request 处置请求体
     * @return true 表示已落库更新
     */
    @Transactional
    public boolean handleAlert(String id, FoodSafetyAlertHandleRequest request) {
        if (request == null || isBlank(request.measure())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处置措施为必填");
        }
        if (isBlank(request.remark())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处置说明为必填");
        }
        if (request.remark().trim().length() > REMARK_MAX_LENGTH) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "处置说明不得超过 200 字");
        }
        FoodSafetyAlertEntity alert = alertMapper.selectById(id);
        if (alert == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "食品安全告警不存在：" + id);
        }
        alert.setStatus(STATUS_HANDLED);
        alert.setMeasure(request.measure().trim());
        alert.setHandleRemark(request.remark().trim());
        alert.setHandleTime(LocalDateTime.now());
        return alertMapper.updateById(alert) > 0;
    }

    /** 库内最新风险统计月；无数据时返回 null。 */
    private YearMonth latestRiskMonth() {
        List<FarmRiskEntity> rows = farmRiskMapper.selectList(new LambdaQueryWrapper<FarmRiskEntity>()
                .isNotNull(FarmRiskEntity::getStatDate)
                .orderByDesc(FarmRiskEntity::getStatDate));
        if (rows.isEmpty()) {
            return null;
        }
        return YearMonth.from(rows.get(0).getStatDate());
    }

    /** 指定月份的农场风险评分均值，1 位小数；无有效评分时返回 null。 */
    private BigDecimal farmRiskAverage(YearMonth month) {
        if (month == null) {
            return null;
        }
        List<FarmRiskEntity> rows = farmRiskMapper.selectList(new LambdaQueryWrapper<FarmRiskEntity>()
                .ge(FarmRiskEntity::getStatDate, month.atDay(1))
                .lt(FarmRiskEntity::getStatDate, month.plusMonths(1).atDay(1)));
        BigDecimal sum = BigDecimal.ZERO;
        int count = 0;
        for (FarmRiskEntity row : rows) {
            if (row.getScore() != null) {
                sum = sum.add(row.getScore());
                count++;
            }
        }
        return count == 0 ? null : sum.divide(BigDecimal.valueOf(count), 1, RoundingMode.HALF_UP);
    }

    /** 指定月份标准校验项达标率（%），1 位小数；无校验项时返回 null。 */
    private BigDecimal itemPassRate(YearMonth month) {
        if (month == null) {
            return null;
        }
        List<StandardItemEntity> items = standardItemMapper.selectList(new LambdaQueryWrapper<StandardItemEntity>()
                .ge(StandardItemEntity::getCheckTime, month.atDay(1).atStartOfDay())
                .lt(StandardItemEntity::getCheckTime, month.plusMonths(1).atDay(1).atStartOfDay()));
        if (items.isEmpty()) {
            return null;
        }
        long pass = items.stream().filter(item -> RESULT_PASS.equals(item.getResult())).count();
        return BigDecimal.valueOf(pass * 100)
                .divide(BigDecimal.valueOf(items.size()), 1, RoundingMode.HALF_UP);
    }

    /** 批次级合规校验通过率（%），1 位小数；无批次时返回 null。 */
    private BigDecimal compliancePassRate() {
        long batch = 0;
        long pass = 0;
        for (StandardSummaryEntity summary : standardSummaryMapper.selectList(null)) {
            batch += summary.getBatchCount() == null ? 0 : summary.getBatchCount();
            pass += summary.getPassCount() == null ? 0 : summary.getPassCount();
        }
        if (batch == 0) {
            return null;
        }
        return BigDecimal.valueOf(pass * 100).divide(BigDecimal.valueOf(batch), 1, RoundingMode.HALF_UP);
    }

    /** 冷链达标率（%）= 非离线资源占比，1 位小数；无资源时返回 null。 */
    private BigDecimal coldChainPassRate() {
        List<ColdChainResourceEntity> resources = coldChainResourceMapper.selectList(null);
        if (resources.isEmpty()) {
            return null;
        }
        long offline = resources.stream()
                .filter(resource -> RESOURCE_OFFLINE.equals(resource.getStatus()))
                .count();
        return BigDecimal.valueOf((resources.size() - offline) * 100)
                .divide(BigDecimal.valueOf(resources.size()), 1, RoundingMode.HALF_UP);
    }

    /** 环比差值（1 位小数）；任一侧无数据则返回 null（不伪造成 0）。 */
    private BigDecimal delta(BigDecimal current, BigDecimal previous) {
        if (current == null || previous == null) {
            return null;
        }
        return current.subtract(previous).setScale(1, RoundingMode.HALF_UP);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
