package com.agri.produce.internal.alert;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 告警规则（阈值/持续时长/通知渠道） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class AlertRuleService {

    private static final String ID_PREFIX = "RULE";

    private final AlertRuleMapper alertRuleMapper;

    /**
     * 分页查询。
     *
     * @param keyword ruleName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<AlertRuleEntity> page(long page, long size, String keyword, Integer status) {
        Page<AlertRuleEntity> result = alertRuleMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AlertRuleEntity>()
                        .like(keyword != null && !keyword.isBlank(), AlertRuleEntity::getRuleName, keyword)
                        .eq(status != null, AlertRuleEntity::getStatus, status)
                        .orderByDesc(AlertRuleEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public AlertRuleEntity detail(String id) {
        AlertRuleEntity entity = alertRuleMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public AlertRuleEntity create(AlertRuleEntity entity) {
        if (entity.getRuleId() == null || entity.getRuleId().isBlank()) {
            entity.setRuleId(ProduceIds.newId(ID_PREFIX));
        }
        alertRuleMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public AlertRuleEntity update(String id, AlertRuleEntity entity) {
        entity.setRuleId(id);
        alertRuleMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        alertRuleMapper.deleteById(id);
    }

    /** 启用/停用规则 */
    @Transactional
    public AlertRuleEntity toggle(String ruleId, int enabledFlag) {
        AlertRuleEntity rule = detail(ruleId);
        rule.setEnabledFlag(enabledFlag);
        alertRuleMapper.updateById(rule);
        return rule;
    }

    /** 启用的规则（告警引擎拉取） */
    public List<AlertRuleEntity> listEnabled() {
        return alertRuleMapper.selectList(new LambdaQueryWrapper<AlertRuleEntity>()
                .eq(AlertRuleEntity::getEnabledFlag, 1)
                .eq(AlertRuleEntity::getStatus, 1));
    }
}
