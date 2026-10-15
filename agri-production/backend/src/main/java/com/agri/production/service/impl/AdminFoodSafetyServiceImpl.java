package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.CirculationAnomaly;
import com.agri.production.entity.FarmRisk;
import com.agri.production.entity.FoodSafetyAlert;
import com.agri.production.entity.FoodSafetyStandardItem;
import com.agri.production.entity.FoodSafetyStandardSummary;
import com.agri.production.mapper.CirculationAnomalyMapper;
import com.agri.production.mapper.FarmRiskMapper;
import com.agri.production.mapper.FoodSafetyAlertMapper;
import com.agri.production.mapper.FoodSafetyStandardItemMapper;
import com.agri.production.mapper.FoodSafetyStandardSummaryMapper;
import com.agri.production.service.IAdminFoodSafetyService;
import com.agri.production.vo.AdminFsAlertVO;
import com.agri.production.vo.AdminFsCirculationVO;
import com.agri.production.vo.AdminFsFarmRiskVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端食品安全实现（第一子域：监测与告警）。
 *
 * <p>口径与平台侧 AdminFoodSafety*Service 对齐，按本服务的表落地。指标里凡是没有数据源的分项，
 * 一律给 0 或 null 并在注释里说明，不填看起来合理的数。</p>
 */
@Slf4j
@Service
public class AdminFoodSafetyServiceImpl implements IAdminFoodSafetyService {

    private static final String STATUS_PENDING = "待处理";
    private static final String STATUS_PROCESSING = "处理中";
    private static final String STATUS_DONE = "已处理";
    private static final String LEVEL_URGENT = "urgent";
    private static final String RESULT_PASS = "pass";
    private static final int ALERT_LIMIT_MAX = 200;

    private final FoodSafetyAlertMapper alertMapper;
    private final CirculationAnomalyMapper circulationMapper;
    private final FarmRiskMapper farmRiskMapper;
    private final FoodSafetyStandardItemMapper standardItemMapper;
    private final FoodSafetyStandardSummaryMapper standardSummaryMapper;

    public AdminFoodSafetyServiceImpl(FoodSafetyAlertMapper alertMapper,
                                     CirculationAnomalyMapper circulationMapper,
                                     FarmRiskMapper farmRiskMapper,
                                     FoodSafetyStandardItemMapper standardItemMapper,
                                     FoodSafetyStandardSummaryMapper standardSummaryMapper) {
        this.alertMapper = alertMapper;
        this.circulationMapper = circulationMapper;
        this.farmRiskMapper = farmRiskMapper;
        this.standardItemMapper = standardItemMapper;
        this.standardSummaryMapper = standardSummaryMapper;
    }

    @Override
    public List<AdminFsAlertVO> listAlerts(int limit) {
        int top = limit > 0 ? Math.min(limit, ALERT_LIMIT_MAX) : 20;
        List<FoodSafetyAlert> alerts = alertMapper.selectList(new LambdaQueryWrapper<FoodSafetyAlert>()
                .orderByDesc(FoodSafetyAlert::getHappenTime)
                .last("LIMIT " + top));
        return alerts.stream().map(AdminFsAlertVO::of).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminFsAlertVO handleAlert(String alertId, String measure, String remark) {
        FoodSafetyAlert alert = requireAlert(alertId);
        if (measure == null || measure.isBlank()) {
            throw new BusinessException(400, "请填写处置措施");
        }
        alert.setMeasure(measure.trim());
        if (remark != null && !remark.isBlank()) {
            alert.setHandleRemark(remark.trim());
        }
        alert.setStatus(STATUS_DONE);
        alert.setHandleTime(LocalDateTime.now());
        alert.setUpdateTime(LocalDateTime.now());
        alertMapper.updateById(alert);
        log.info("食品安全告警处置：{} → {}", alert.getAlertId(), measure.trim());
        return AdminFsAlertVO.of(alertMapper.selectById(alert.getAlertId()));
    }

    @Override
    public PageResult<AdminFsCirculationVO> pageCirculation(int pageNum, int pageSize, String type, String severity,
                                                           String date, String keyword) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<CirculationAnomaly> w = new LambdaQueryWrapper<>();
        if (type != null && !type.isBlank() && !"all".equalsIgnoreCase(type)) {
            w.eq(CirculationAnomaly::getAnomalyType, type.trim().toLowerCase());
        }
        if (severity != null && !severity.isBlank() && !"all".equalsIgnoreCase(severity)) {
            w.eq(CirculationAnomaly::getSeverity, severity.trim().toLowerCase());
        }
        if (date != null && !date.isBlank()) {
            try {
                w.eq(CirculationAnomaly::getFoundDate, LocalDate.parse(date.trim().substring(0, 10)));
            } catch (Exception e) {
                // 日期传坏时**明确报错**，而不是当没传（否则筛选静默失效，看起来"这天没有异常"）
                throw new BusinessException(400, "发现日期格式应为 yyyy-MM-dd，收到：" + date);
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(CirculationAnomaly::getAnomalyId, kw)
                    .or().like(CirculationAnomaly::getBatchNo, kw)
                    .or().like(CirculationAnomaly::getProductName, kw));
        }
        w.orderByDesc(CirculationAnomaly::getFoundTime).orderByDesc(CirculationAnomaly::getAnomalyId);
        Page<CirculationAnomaly> page = circulationMapper.selectPage(new Page<>(p, s), w);
        List<AdminFsCirculationVO> rows = page.getRecords().stream().map(AdminFsCirculationVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminFsCirculationVO handleCirculation(String anomalyId, String action, String remark) {
        if (anomalyId == null || anomalyId.isBlank()) {
            throw new BusinessException(400, "缺少异常编号");
        }
        CirculationAnomaly anomaly = circulationMapper.selectById(anomalyId.trim());
        if (anomaly == null) {
            throw new BusinessException(404, "流通异常记录不存在：" + anomalyId);
        }
        if (action == null || action.isBlank()) {
            throw new BusinessException(400, "请选择处置方式");
        }
        anomaly.setMeasure(action.trim());
        if (remark != null && !remark.isBlank()) {
            anomaly.setHandleRemark(remark.trim());
        }
        anomaly.setStatus("done");
        anomaly.setHandleTime(LocalDateTime.now());
        anomaly.setUpdateTime(LocalDateTime.now());
        circulationMapper.updateById(anomaly);
        log.info("流通异常处置：{} → {}", anomaly.getAnomalyId(), action.trim());
        return AdminFsCirculationVO.of(circulationMapper.selectById(anomaly.getAnomalyId()));
    }

    @Override
    public List<AdminFsFarmRiskVO> riskDistribution() {
        // 当期 = 库里最新的统计月份（与平台侧同口径：以每月 1 日为锚点，没有当期数据就返回空列表）
        YearMonth current = latestRiskMonth();
        if (current == null) {
            return List.of();
        }
        List<FarmRisk> risks = farmRiskMapper.selectList(new LambdaQueryWrapper<FarmRisk>()
                .ge(FarmRisk::getStatDate, current.atDay(1))
                .lt(FarmRisk::getStatDate, current.plusMonths(1).atDay(1))
                .orderByDesc(FarmRisk::getScore));
        return risks.stream().map(AdminFsFarmRiskVO::of).toList();
    }

    private YearMonth latestRiskMonth() {
        FarmRisk latest = farmRiskMapper.selectOne(new LambdaQueryWrapper<FarmRisk>()
                .isNotNull(FarmRisk::getStatDate)
                .orderByDesc(FarmRisk::getStatDate).last("LIMIT 1"));
        return latest == null || latest.getStatDate() == null ? null : YearMonth.from(latest.getStatDate());
    }

    @Override
    public Map<String, Object> metrics() {
        YearMonth current = latestRiskMonth();
        YearMonth previous = current == null ? null : current.minusMonths(1);
        BigDecimal safetyIndex = farmRiskAverage(current);
        BigDecimal previousSafetyIndex = farmRiskAverage(previous);
        long previousSampleCount = farmRiskSampleCount(previous);

        // 合规指标按**校验项明细自身的时间**算当期，与风险评分用哪个月无关：
        // 两条链的数据不是同一天产生的，强行共用一个"当期"会把某一边算成空。
        YearMonth itemMonth = latestItemMonth();
        BigDecimal passRate = itemPassRate(itemMonth);
        BigDecimal previousPassRate = itemPassRate(itemMonth == null ? null : itemMonth.minusMonths(1));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("safetyIndex", safetyIndex);
        result.put("safetyIndexDelta", delta(safetyIndex, previousSafetyIndex, previousSampleCount));
        result.put("passRate", passRate);
        result.put("passRateDelta", rateDelta(passRate, previousPassRate));
        Long alertCount = alertMapper.selectCount(new LambdaQueryWrapper<>());
        result.put("alertCount", alertCount == null ? 0L : alertCount);
        Long urgent = alertMapper.selectCount(new LambdaQueryWrapper<FoodSafetyAlert>()
                .eq(FoodSafetyAlert::getLevel, LEVEL_URGENT));
        result.put("urgentAlertCount", urgent == null ? 0L : urgent);
        result.put("compliancePassRate", compliancePassRate());
        // 冷链资源表还没有数据（冷链子域未接入）。这里给 0 是**占位**，不代表"达标率 0%"：
        // 与合规两项不同，它现在连一行输入都没有。子域接入后立刻改成真算（见 IAdminFoodSafetyService 注释）。
        result.put("coldChainPassRate", BigDecimal.ZERO);
        result.put("pendingAlertCount", alertMapper.selectCount(new LambdaQueryWrapper<FoodSafetyAlert>()
                .in(FoodSafetyAlert::getStatus, List.of(STATUS_PENDING, STATUS_PROCESSING))));
        return result;
    }

    /** 明细里最新的抽检月份（没有明细则为 null）。 */
    private YearMonth latestItemMonth() {
        FoodSafetyStandardItem latest = standardItemMapper.selectOne(new LambdaQueryWrapper<FoodSafetyStandardItem>()
                .isNotNull(FoodSafetyStandardItem::getCheckTime)
                .orderByDesc(FoodSafetyStandardItem::getCheckTime).last("LIMIT 1"));
        return latest == null || latest.getCheckTime() == null ? null : YearMonth.from(latest.getCheckTime());
    }

    /** 当期标准校验项的合格占比（%），1 位小数；该月没有抽检项时返回 null。 */
    private BigDecimal itemPassRate(YearMonth month) {
        if (month == null) {
            return null;
        }
        List<FoodSafetyStandardItem> items = standardItemMapper.selectList(
                new LambdaQueryWrapper<FoodSafetyStandardItem>()
                        .ge(FoodSafetyStandardItem::getCheckTime, month.atDay(1).atStartOfDay())
                        .lt(FoodSafetyStandardItem::getCheckTime, month.plusMonths(1).atDay(1).atStartOfDay()));
        if (items.isEmpty()) {
            return null;
        }
        long pass = items.stream().filter(item -> RESULT_PASS.equals(item.getCheckResult())).count();
        return BigDecimal.valueOf(pass * 100)
                .divide(BigDecimal.valueOf(items.size()), 1, RoundingMode.HALF_UP);
    }

    /** 批次级合规校验通过率（%）：全部标准的 pass_count / batch_count 之和；无批次时 null。 */
    private BigDecimal compliancePassRate() {
        long batch = 0;
        long pass = 0;
        for (FoodSafetyStandardSummary summary : standardSummaryMapper.selectList(null)) {
            batch += summary.getBatchCount() == null ? 0 : summary.getBatchCount();
            pass += summary.getPassCount() == null ? 0 : summary.getPassCount();
        }
        if (batch == 0) {
            return null;
        }
        return BigDecimal.valueOf(pass * 100).divide(BigDecimal.valueOf(batch), 1, RoundingMode.HALF_UP);
    }

    private BigDecimal farmRiskAverage(YearMonth month) {
        if (month == null) {
            return BigDecimal.ZERO;
        }
        List<FarmRisk> risks = farmRiskMapper.selectList(new LambdaQueryWrapper<FarmRisk>()
                .ge(FarmRisk::getStatDate, month.atDay(1))
                .lt(FarmRisk::getStatDate, month.plusMonths(1).atDay(1)));
        List<BigDecimal> scores = risks.stream().map(FarmRisk::getScore)
                .filter(java.util.Objects::nonNull).toList();
        if (scores.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = scores.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(BigDecimal.valueOf(scores.size()), 1, RoundingMode.HALF_UP);
    }

    /** 上半年有没有数据，是靠**样本条数**判断的，不是靠平均值是不是 0 */
    private long farmRiskSampleCount(YearMonth month) {
        if (month == null) {
            return 0L;
        }
        Long hits = farmRiskMapper.selectCount(new LambdaQueryWrapper<FarmRisk>()
                .ge(FarmRisk::getStatDate, month.atDay(1))
                .lt(FarmRisk::getStatDate, month.plusMonths(1).atDay(1)));
        return hits == null ? 0L : hits;
    }

    /**
     * 环比增量。
     *
     * <p><b>上一期没有样本时返回 null，而不是"本期值 - 0"</b>：后者会显示成"环比 +83.3"，
     * 看起来像一个真实的暴涨，实际只是没有可比数据。页面按 null 渲染「—」。</p>
     */
    private BigDecimal delta(BigDecimal current, BigDecimal previous, long previousSampleCount) {
        if (current == null || previous == null || previousSampleCount == 0) {
            return null;
        }
        return current.subtract(previous).setScale(1, RoundingMode.HALF_UP);
    }

    /**
     * 通过率的环比增量（百分点）。
     *
     * <p>上一期没有样本时返回 null —— 与 {@link #delta} 同一个理由：
     * 用"本期 - 0"会显示成一次真实的暴涨。</p>
     */
    private BigDecimal rateDelta(BigDecimal current, BigDecimal previous) {
        if (current == null || previous == null) {
            return null;
        }
        return current.subtract(previous).setScale(1, RoundingMode.HALF_UP);
    }

    private FoodSafetyAlert requireAlert(String alertId) {
        if (alertId == null || alertId.isBlank()) {
            throw new BusinessException(400, "缺少告警编号");
        }
        FoodSafetyAlert alert = alertMapper.selectById(alertId.trim());
        if (alert == null) {
            throw new BusinessException(404, "告警不存在：" + alertId);
        }
        return alert;
    }
}
