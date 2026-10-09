package com.agri.produce.internal.admin;

import com.agri.produce.internal.alert.AlertInfoEntity;
import com.agri.produce.internal.alert.AlertInfoMapper;
import com.agri.produce.internal.alert.AlertRuleEntity;
import com.agri.produce.internal.alert.AlertRuleMapper;
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
import java.util.Map;

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
     * 告警记录分页。
     *
     * @param page   页码
     * @param size   每页条数
     * @param status 状态过滤
     * @return 分页结果
     */
    public PageResult<AlertInfoEntity> pageAlerts(long page, long size, String status) {
        Page<AlertInfoEntity> result = alertInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AlertInfoEntity>()
                        .eq(status != null && !status.isBlank(), AlertInfoEntity::getStatus, status)
                        .orderByDesc(AlertInfoEntity::getAlertTime));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
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
                .eq(AlertInfoEntity::getStatus, "HANDLED"));
        for (String level : List.of("INFO", "WARN", "CRITICAL")) {
            result.put(level, alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                    .eq(AlertInfoEntity::getAlertLevel, level)));
        }
        result.put("total", total);
        result.put("handled", handled);
        result.put("handleRate", total == 0 ? 0 : handled * 100 / total);
        return result;
    }

    /**
     * 告警派单：指派处置人并置为处理中状态。
     *
     * @param alertId   告警ID
     * @param memberId  处置成员ID
     * @param remark    派单说明
     * @return 告警记录
     */
    @Transactional
    public AlertInfoEntity dispatch(String alertId, String memberId, String remark) {
        AlertInfoEntity alert = alertInfoMapper.selectById(alertId);
        if (alert == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        MemberEntity member = memberMapper.selectById(memberId);
        alert.setHandleBy(member == null ? memberId : member.getMemberName());
        alert.setHandleRemark(remark);
        alert.setHandleTime(LocalDateTime.now());
        alert.setStatus("HANDLED");
        alertInfoMapper.updateById(alert);
        return alert;
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

    /** 紧急告警：CRITICAL 级别且未处置 */
    public List<AlertInfoEntity> emergency(int minutes) {
        return alertInfoMapper.selectList(new LambdaQueryWrapper<AlertInfoEntity>()
                .eq(AlertInfoEntity::getAlertLevel, "CRITICAL")
                .eq(AlertInfoEntity::getStatus, "PENDING")
                .ge(AlertInfoEntity::getAlertTime, LocalDateTime.now().minusMinutes(minutes))
                .orderByDesc(AlertInfoEntity::getAlertTime));
    }

    /** 告警复核：已处置记录，按处置时间倒序 */
    public PageResult<AlertInfoEntity> review(long page, long size) {
        Page<AlertInfoEntity> result = alertInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AlertInfoEntity>()
                        .eq(AlertInfoEntity::getStatus, "HANDLED")
                        .orderByDesc(AlertInfoEntity::getHandleTime));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }
}
