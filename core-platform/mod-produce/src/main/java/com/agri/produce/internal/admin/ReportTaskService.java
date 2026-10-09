package com.agri.produce.internal.admin;

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
 * 监管/经营报表生成任务 应用服务。
 */
@Service
@RequiredArgsConstructor
public class ReportTaskService {

    private static final String ID_PREFIX = "RPT";

    private final ReportTaskMapper reportTaskMapper;

    /**
     * 分页查询。
     *
     * @param keyword reportName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<ReportTaskEntity> page(long page, long size, String keyword, String status) {
        Page<ReportTaskEntity> result = reportTaskMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<ReportTaskEntity>()
                        .like(keyword != null && !keyword.isBlank(), ReportTaskEntity::getReportName, keyword)
                        .eq(status != null && !status.isBlank(), ReportTaskEntity::getStatus, status)
                        .orderByDesc(ReportTaskEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public ReportTaskEntity detail(String id) {
        ReportTaskEntity entity = reportTaskMapper.selectById(id);
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
    public ReportTaskEntity create(ReportTaskEntity entity) {
        if (entity.getReportId() == null || entity.getReportId().isBlank()) {
            entity.setReportId(ProduceIds.newId(ID_PREFIX));
        }
        reportTaskMapper.insert(entity);
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
    public ReportTaskEntity update(String id, ReportTaskEntity entity) {
        entity.setReportId(id);
        reportTaskMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        reportTaskMapper.deleteById(id);
    }

    /** 触发生成：置 DONE 并回填文件地址（真实导出后置） */
    @Transactional
    public ReportTaskEntity generate(String reportId) {
        ReportTaskEntity task = detail(reportId);
        task.setStatus("DONE");
        task.setGeneratedAt(LocalDateTime.now());
        task.setFileUrl("/report/" + reportId + ".xlsx");
        reportTaskMapper.updateById(task);
        return task;
    }

    /** 按类型查询 */
    public List<ReportTaskEntity> listByType(String reportType) {
        return reportTaskMapper.selectList(new LambdaQueryWrapper<ReportTaskEntity>()
                .eq(reportType != null && !reportType.isBlank(),
                        ReportTaskEntity::getReportType, reportType)
                .orderByDesc(ReportTaskEntity::getCreatedAt));
    }
}
