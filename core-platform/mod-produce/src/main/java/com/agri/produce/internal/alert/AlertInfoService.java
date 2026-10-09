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
 * 告警记录（规则触发后的处置闭环） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class AlertInfoService {

    private static final String ID_PREFIX = "ALRT";

    private final AlertInfoMapper alertInfoMapper;

    /**
     * 分页查询。
     *
     * @param keyword alertTitle 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<AlertInfoEntity> page(long page, long size, String keyword, String status) {
        Page<AlertInfoEntity> result = alertInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AlertInfoEntity>()
                        .like(keyword != null && !keyword.isBlank(), AlertInfoEntity::getAlertTitle, keyword)
                        .eq(status != null && !status.isBlank(), AlertInfoEntity::getStatus, status)
                        .orderByDesc(AlertInfoEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public AlertInfoEntity detail(String id) {
        AlertInfoEntity entity = alertInfoMapper.selectById(id);
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
    public AlertInfoEntity create(AlertInfoEntity entity) {
        if (entity.getAlertId() == null || entity.getAlertId().isBlank()) {
            entity.setAlertId(ProduceIds.newId(ID_PREFIX));
        }
        alertInfoMapper.insert(entity);
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
    public AlertInfoEntity update(String id, AlertInfoEntity entity) {
        entity.setAlertId(id);
        alertInfoMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        alertInfoMapper.deleteById(id);
    }

    /** 未处置告警 */
    public List<AlertInfoEntity> listUnhandled() {
        return alertInfoMapper.selectList(new LambdaQueryWrapper<AlertInfoEntity>()
                .eq(AlertInfoEntity::getStatus, "PENDING")
                .orderByDesc(AlertInfoEntity::getAlertTime));
    }

    /** 处置告警 */
    @Transactional
    public AlertInfoEntity handle(String alertId, String handleBy, String remark, boolean ignore) {
        AlertInfoEntity alert = detail(alertId);
        alert.setHandleBy(handleBy);
        alert.setHandleRemark(remark);
        alert.setHandleTime(LocalDateTime.now());
        alert.setStatus(ignore ? "IGNORED" : "HANDLED");
        alertInfoMapper.updateById(alert);
        return alert;
    }

    /** 告警级别分布 */
    public Map<String, Object> stats() {
        Map<String, Object> result = new LinkedHashMap<>();
        for (String level : List.of("INFO", "WARN", "CRITICAL")) {
            result.put(level, alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                    .eq(AlertInfoEntity::getAlertLevel, level)));
        }
        result.put("pending", alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                .eq(AlertInfoEntity::getStatus, "PENDING")));
        return result;
    }
}
