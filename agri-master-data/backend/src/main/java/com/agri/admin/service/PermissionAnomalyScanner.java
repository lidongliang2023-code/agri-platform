package com.agri.admin.service;

import com.agri.admin.vo.AnomalyFinding;
import com.agri.masterdata.entity.PermissionAnomaly;
import com.agri.masterdata.entity.PermissionRule;
import com.agri.masterdata.mapper.PermissionAnomalyMapper;
import com.agri.masterdata.mapper.PermissionRuleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 权限异常扫描器 —— "这条授权算不算异常"的唯一一处判定。
 *
 * <p>此前 {@code /permission/anomaly} 固定返回空数组，页面挂横幅说"巡检引擎尚未接入数据源"。
 * 缺的确实不是数据，是<b>规则表 + 按规则扫描的任务</b>：规则与阈值放在
 * {@code agri_md_permission_rule}，互斥对放在 {@code agri_md_role_mutex}，
 * 每条规则的判定 SQL 在 {@code PermissionAnomalyMapper.xml} 里一一对应。</p>
 *
 * <p>三条设计约束：</p>
 * <ol>
 *   <li><b>只报能从库里算出来的结论</b>。四条口径（权限过大 / 互斥角色 / 过期权限 / 重复·幽灵）
 *       全部由真实授权关系推出，detail 里带具体数字与对象名；不产出"示例异常"。</li>
 *   <li><b>结果可复核、可消解</b>。按 (规则, 对象类型, 对象) 唯一，重复扫描只推进 last_seen；
 *       本轮没再复现的自动转 RESOLVED，改完授权不会一直挂着。</li>
 *   <li><b>规则不认识就跳过并留日志</b>。库里被加了一条新 metric 而代码不认时，
 *       静默跳过比"猜一个判定"安全，但必须能被发现。</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PermissionAnomalyScanner {

    /** 规则编码：与 agri_md_permission_rule.rule_code 一致。 */
    public static final String RULE_OVER_PRIVILEGE = "OVER_PRIVILEGE";
    public static final String RULE_MUTEX_ROLE = "MUTEX_ROLE";
    public static final String RULE_EXPIRED_GRANT = "EXPIRED_GRANT";
    public static final String RULE_BINDING_INTEGRITY = "BINDING_INTEGRITY";

    /** 判定口径取值（一条 metric 对应一处查询）。 */
    private static final String METRIC_USER_MENU_COUNT = "USER_MENU_COUNT";
    private static final String METRIC_ROLE_MUTEX_PAIR = "ROLE_MUTEX_PAIR";
    private static final String METRIC_GRANT_EXPIRE = "GRANT_EXPIRE";
    private static final String METRIC_BINDING_INTEGRITY = "BINDING_INTEGRITY";

    /** 列表上限：审计页一次看全，超过这个量说明规则阈值设得不合理，而不是偷偷截断。 */
    private static final int MAX_LIST_SIZE = 500;

    private final PermissionRuleMapper ruleMapper;
    private final PermissionAnomalyMapper anomalyMapper;

    /**
     * 扫描一次。手动触发（页面「重新检测」）与每日定时任务共用这一处实现，
     * 所以两条路径给出的结论必然一致。
     *
     * @return findings=本轮命中的异常条数，resolved=本轮未复现被转成已处置的条数，scannedAt=扫描时间
     */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> scan() {
        /**
         * 截到秒：列是 DATETIME（只存到秒）。消解已经改成"先全量置已处置、再由本轮发现重新打开"，
         * 不再比较时间戳，但 first/last_seen 仍要能对上，所以统一用整秒。
         */
        LocalDateTime startedAt = LocalDateTime.now().withNano(0);
        // 本轮的结论是"现在库里有哪些异常"，所以先把所有未处置收掉，再由发现重新打开
        anomalyMapper.resolveAllOpen();
        List<PermissionRule> rules = ruleMapper.selectList(
                new LambdaQueryWrapper<PermissionRule>().eq(PermissionRule::getEnabled, 1));
        int findings = 0;
        for (PermissionRule rule : rules) {
            findings += applyRule(rule, startedAt);
        }
        int resolved = anomalyMapper.countNewlyResolved(startedAt);
        log.info("权限巡检完成：规则 {} 条、命中 {} 条、本轮消解 {} 条",
                rules.size(), findings, resolved);
        Map<String, Object> result = new HashMap<>();
        result.put("rules", rules.size());
        result.put("findings", findings);
        result.put("resolved", resolved);
        result.put("scannedAt", startedAt.toString());
        return result;
    }

    /** 未处置（OPEN）的异常；status 传 RESOLVED 看历史。 */
    public List<PermissionAnomaly> list(String status) {
        return anomalyMapper.selectByStatus(status, MAX_LIST_SIZE);
    }

    /** 生效中的规则（页面把"判定口径"照实渲染，阈值来自库里而不是模板里写死的四行说明）。 */
    public List<PermissionRule> enabledRules() {
        return ruleMapper.selectList(new LambdaQueryWrapper<PermissionRule>()
                .eq(PermissionRule::getEnabled, 1)
                .orderByAsc(PermissionRule::getId));
    }

    /** 上次扫描时间；库里一条结果都没有时为 null（页面显示"尚未扫描"）。 */
    public LocalDateTime lastScanAt() {
        return anomalyMapper.selectLastScanAt();
    }

    /** 未处置条数（统计卡的"异常总数"读它，不再写死 0）。 */
    public long openCount() {
        return anomalyMapper.selectCount(new LambdaQueryWrapper<PermissionAnomaly>()
                .eq(PermissionAnomaly::getStatus, "OPEN"));
    }

    public List<PermissionAnomaly> anomaliesForStatistics() {
        return anomalyMapper.selectByStatus(null, MAX_LIST_SIZE);
    }

    public List<com.agri.admin.vo.PermissionStatisticsVO.RoleDistribution> roleDistribution(String tenantId) {
        return anomalyMapper.selectRoleDistribution(tenantId);
    }

    public List<com.agri.admin.vo.PermissionStatisticsVO.PermissionTrend> trends(int days) {
        return anomalyMapper.selectTrends(days);
    }

    /**
     * 执行一条规则：按 metric 找到对应的查询，把发现逐条落库。
     *
     * @return 本条规则命中的数量
     */
    private int applyRule(PermissionRule rule, LocalDateTime scanAt) {
        String metric = rule.getMetric() == null ? "" : rule.getMetric().trim().toUpperCase();
        List<AnomalyFinding> found;
        switch (metric) {
            case METRIC_USER_MENU_COUNT -> {
                // 阈值缺失时不猜一个数：这条规则当"未配置"跳过，页面规则表会显示阈值 —
                if (rule.getThreshold() == null || rule.getThreshold() <= 0) {
                    log.warn("权限巡检规则 {} 没有可用阈值，本轮跳过（不拿默认值冒充配置）", rule.getRuleCode());
                    return 0;
                }
                found = anomalyMapper.selectOverPrivilegedUsers(rule.getThreshold());
            }
            case METRIC_ROLE_MUTEX_PAIR -> found = anomalyMapper.selectMutexRoleHolders();
            case METRIC_GRANT_EXPIRE -> found = anomalyMapper.selectExpiredGrants();
            case METRIC_BINDING_INTEGRITY -> {
                // 重复与幽灵是同一类"绑定完整性"问题，合成一条规则、两个查询
                List<AnomalyFinding> dup = anomalyMapper.selectDuplicateBindings();
                List<AnomalyFinding> orphan = anomalyMapper.selectOrphanBindings();
                found = new java.util.ArrayList<>(dup);
                found.addAll(orphan);
            }
            default -> {
                log.warn("权限巡检规则 {} 的 metric「{}」没有对应实现，本轮跳过", rule.getRuleCode(), rule.getMetric());
                return 0;
            }
        }
        for (AnomalyFinding item : found) {
            anomalyMapper.upsertFinding(toEntity(rule, item, scanAt));
        }
        return found.size();
    }

    private PermissionAnomaly toEntity(PermissionRule rule, AnomalyFinding finding, LocalDateTime scanAt) {
        PermissionAnomaly entity = new PermissionAnomaly();
        entity.setRuleCode(rule.getRuleCode());
        entity.setAnomalyType(rule.getAnomalyType());
        entity.setSeverity(rule.getSeverity());
        entity.setTargetType(finding.getTargetType());
        entity.setTargetId(finding.getTargetId());
        entity.setTargetName(finding.getTargetName());
        entity.setTenantId(finding.getTenantId());
        entity.setDetail(finding.getDetail());
        entity.setStatus("OPEN");
        entity.setFirstSeen(scanAt);
        entity.setLastSeen(scanAt);
        entity.setDelFlag(0);
        return entity;
    }
}
