package com.agri.produce.internal.admin;

import com.agri.produce.internal.alert.AlertDict;
import com.agri.produce.internal.alert.AlertInfoEntity;
import com.agri.produce.internal.alert.AlertInfoMapper;
import com.agri.produce.internal.alert.AlertRuleEntity;
import com.agri.produce.internal.alert.AlertRuleMapper;
import com.agri.produce.internal.alert.AlertVO;
import com.agri.produce.internal.member.MemberEntity;
import com.agri.produce.internal.member.MemberMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.IntFunction;

/**
 * 运营端：告警监管（规则治理、统计、派单处置）。
 */
@Service
@RequiredArgsConstructor
public class AdminAlertService {

    private final AlertRuleMapper alertRuleMapper;
    private final AlertInfoMapper alertInfoMapper;
    private final MemberMapper memberMapper;

    /**
     * 告警规则分页。
     *
     * @param page    页码
     * @param size    每页条数
     * @param keyword 规则名称关键字
     * @param level   告警级别过滤
     * @return 分页结果
     */
    public PageResult<AlertRuleEntity> pageRules(long page, long size, String keyword, String level) {
        Page<AlertRuleEntity> result = alertRuleMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AlertRuleEntity>()
                        .like(keyword != null && !keyword.isBlank(), AlertRuleEntity::getRuleName, keyword)
                        .eq(level != null && !level.isBlank(), AlertRuleEntity::getAlertLevel, level)
                        .orderByDesc(AlertRuleEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 告警记录分页（对外一律 {@link AlertVO}）。
     *
     * <p><b>为什么返回 VO 而不是实体。</b>运营端告警中心
     * {@code src/pages/admin/alerts/AdminAlertCenter.tsx} 的 {@code LEVEL_MAP} /
     * {@code STATUS_MAP} 以数字 {@code 1/2/3/4} 为键；实体 {@link AlertInfoEntity} 的
     * {@code alertLevel/status} 是库内英文枚举（{@code URGENT/PENDING}），
     * {@code MAP['URGENT']} 取到 undefined 后访问 {@code .color} 直接抛错整页白屏。
     * 与用户端 {@code /api/v1/production/alerts} 保持同一口径，转换复用 {@link AlertDict}。
     *
     * <p><b>为什么入参收数字。</b>前端 {@code src/api/admin/alerts.ts listAdminAlerts}
     * 传的是 {@code status?: number} / {@code alertLevel?: number}，而库内存英文枚举，
     * 直接把 {@code "1"} 当 {@code status} 拼进 SQL 永远筛不中。这里统一转成库内枚举。
     * 非数字的旧调用（如 {@code PENDING}）仍按英文枚举兼容。
     *
     * @param page       页码
     * @param size       每页条数
     * @param status     状态：1未处理 2处理中 3已处理 4已忽略；null/空白表示不过滤
     * @param alertLevel 级别：1提示 2一般 3严重 4紧急；null/空白表示不过滤
     * @return 分页结果（对外视图）
     */
    public PageResult<AlertVO> pageAlerts(long page, long size, String status, String alertLevel) {
        String dbStatus = toDbEnum(status, AlertDict::statusOf);
        String dbLevel = toDbEnum(alertLevel, AlertDict::levelOf);
        Page<AlertInfoEntity> result = alertInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AlertInfoEntity>()
                        .eq(dbStatus != null, AlertInfoEntity::getStatus, dbStatus)
                        .eq(dbLevel != null, AlertInfoEntity::getAlertLevel, dbLevel)
                        .orderByDesc(AlertInfoEntity::getAlertTime));
        List<AlertVO> records = result.getRecords().stream().map(AlertVO::from).toList();
        return PageResult.of(records, result.getTotal(), page, size);
    }

    /**
     * 把对外数字编码（或兼容的历史英文枚举）统一成库内英文枚举。
     *
     * @param raw    原始入参，允许 null/空白（表示不过滤）
     * @param mapper 数字编码 → 库内枚举的转换器（{@link AlertDict#statusOf} / {@link AlertDict#levelOf}）
     * @return 库内枚举；入参为空返回 null；取值非法由 mapper 抛 BAD_REQUEST，不静默吞掉
     */
    private static String toDbEnum(String raw, IntFunction<String> mapper) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String value = raw.trim();
        // 纯数字按对外编码解释；1-9 位足够覆盖枚举取值，更长的一律不当数字处理，避免 parseInt 溢出
        if (value.matches("\\d{1,9}")) {
            return mapper.apply(Integer.parseInt(value));
        }
        return value.toUpperCase(Locale.ROOT);
    }

    /**
     * 告警统计：级别分布 + 处置率。
     *
     * @return 统计指标
     */
    public Map<String, Object> stats() {
        Map<String, Object> result = new LinkedHashMap<>();
        long total = alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>());
        long handled = alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                .eq(AlertInfoEntity::getStatus, AlertDict.STATUS_HANDLED));
        // 键保持旧词表（前端按键取值），计数范围覆盖新旧两套写法，迁移前后数字都对
        for (String level : List.of(AlertDict.LEVEL_INFO_LEGACY,
                AlertDict.LEVEL_WARN_LEGACY,
                AlertDict.LEVEL_CRITICAL_LEGACY)) {
            result.put(level, alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                    .in(AlertInfoEntity::getAlertLevel, AlertDict.levelValuesOfName(level))));
        }
        result.put("total", total);
        result.put("handled", handled);
        result.put("handleRate", total == 0 ? 0 : handled * 100 / total);
        return result;
    }

    /**
     * 告警派单：指派处置人并置为处理中状态。
     *
     * <p>对外返回 {@link AlertVO}（status/alertLevel 已转数字），与列表端点同口径。
     * 返回值直接吐实体会让调用方拿到 {@code "HANDLED"} 这种库内英文枚举。
     *
     * @param alertId   告警ID
     * @param memberId  处置成员ID
     * @param remark    派单说明
     * @return 派单后的告警（对外视图）
     */
    @Transactional
    public AlertVO dispatch(String alertId, String memberId, String remark) {
        AlertInfoEntity alert = alertInfoMapper.selectById(alertId);
        if (alert == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        MemberEntity member = memberMapper.selectById(memberId);
        alert.setHandleBy(member == null ? memberId : member.getMemberName());
        alert.setHandleRemark(remark);
        alert.setHandleTime(LocalDateTime.now());
        alert.setStatus(AlertDict.STATUS_HANDLED);
        alertInfoMapper.updateById(alert);
        return AlertVO.from(alert);
    }

    /**
     * 启用/停用告警规则（监管侧强制）。
     *
     * @param ruleId      规则ID
     * @param enabledFlag 1 启用 0 停用
     * @return 规则
     */
    @Transactional
    public AlertRuleEntity toggleRule(String ruleId, int enabledFlag) {
        AlertRuleEntity rule = alertRuleMapper.selectById(ruleId);
        if (rule == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        rule.setEnabledFlag(enabledFlag);
        alertRuleMapper.updateById(rule);
        return rule;
    }

    /**
     * 紧急告警：CRITICAL 级别且未处置。
     *
     * <p>对外返回 {@link AlertVO}。筛选条件仍按库内英文枚举（{@code CRITICAL/PENDING}），
     * 由 {@link AlertDict} 的常量表达，不在 SQL 里散写字面量。
     *
     * @param minutes 回溯分钟数
     * @return 紧急告警列表（对外视图）
     */
    public List<AlertVO> emergency(int minutes) {
        // 3=严重：旧 CRITICAL / 新 important 都要命中，走 IN 而非 EQ
        List<AlertInfoEntity> entities = alertInfoMapper.selectList(new LambdaQueryWrapper<AlertInfoEntity>()
                .in(AlertInfoEntity::getAlertLevel, AlertDict.levelValuesOf(3))
                .eq(AlertInfoEntity::getStatus, AlertDict.STATUS_PENDING)
                .ge(AlertInfoEntity::getAlertTime, LocalDateTime.now().minusMinutes(minutes))
                .orderByDesc(AlertInfoEntity::getAlertTime));
        return entities.stream().map(AlertVO::from).toList();
    }

    /**
     * 告警复核：已处置记录，按处置时间倒序。
     *
     * <p><b>为什么必须返回 VO。</b>运营端「灾情复核」页（{@code /admin/production/alerts/review}）
     * 与告警中心共用数字枚举映射，此前直接吐实体 {@link AlertInfoEntity}，
     * {@code alertLevel} 是 {@code "URGENT"} 这类英文串，前端取 {@code LEVEL_MAP['URGENT']}
     * 得到 undefined 后访问 {@code .color} 抛错，页面崩溃（实测 pageerror 4 条）。
     *
     * @param page 页码
     * @param size 每页条数
     * @return 分页结果（对外视图）
     */
    public PageResult<AlertVO> review(long page, long size) {
        Page<AlertInfoEntity> result = alertInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AlertInfoEntity>()
                        .eq(AlertInfoEntity::getStatus, AlertDict.STATUS_HANDLED)
                        .orderByDesc(AlertInfoEntity::getHandleTime));
        List<AlertVO> records = result.getRecords().stream().map(AlertVO::from).toList();
        return PageResult.of(records, result.getTotal(), page, size);
    }
}
