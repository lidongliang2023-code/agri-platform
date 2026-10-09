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
 * 审批单（认证/召回/配额变更等） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private static final String ID_PREFIX = "APPR";

    private final ApprovalMapper approvalMapper;

    /**
     * 分页查询。
     *
     * @param keyword title 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<ApprovalEntity> page(long page, long size, String keyword, String status) {
        Page<ApprovalEntity> result = approvalMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<ApprovalEntity>()
                        .like(keyword != null && !keyword.isBlank(), ApprovalEntity::getTitle, keyword)
                        .eq(status != null && !status.isBlank(), ApprovalEntity::getStatus, status)
                        .orderByDesc(ApprovalEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public ApprovalEntity detail(String id) {
        ApprovalEntity entity = approvalMapper.selectById(id);
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
    public ApprovalEntity create(ApprovalEntity entity) {
        if (entity.getApprovalId() == null || entity.getApprovalId().isBlank()) {
            entity.setApprovalId(ProduceIds.newId(ID_PREFIX));
        }
        approvalMapper.insert(entity);
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
    public ApprovalEntity update(String id, ApprovalEntity entity) {
        entity.setApprovalId(id);
        approvalMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        approvalMapper.deleteById(id);
    }

    /** 审批通过 */
    @Transactional
    public ApprovalEntity approve(String approvalId, String approverId, String opinion) {
        ApprovalEntity approval = detail(approvalId);
        approval.setCurrentApproverId(approverId);
        approval.setApproveOpinion(opinion);
        approval.setApproveAt(LocalDateTime.now());
        approval.setStatus("APPROVED");
        approvalMapper.updateById(approval);
        return approval;
    }

    /** 审批驳回 */
    @Transactional
    public ApprovalEntity reject(String approvalId, String approverId, String opinion) {
        ApprovalEntity approval = detail(approvalId);
        approval.setCurrentApproverId(approverId);
        approval.setApproveOpinion(opinion);
        approval.setApproveAt(LocalDateTime.now());
        approval.setStatus("REJECTED");
        approvalMapper.updateById(approval);
        return approval;
    }

    /** 待我审批 */
    public List<ApprovalEntity> listPending(String approverId) {
        return approvalMapper.selectList(new LambdaQueryWrapper<ApprovalEntity>()
                .eq(ApprovalEntity::getStatus, "PENDING")
                .eq(approverId != null && !approverId.isBlank(),
                        ApprovalEntity::getCurrentApproverId, approverId)
                .orderByAsc(ApprovalEntity::getSubmitAt));
    }

    /** 审批历史：已审批/已驳回，按审批时间倒序 */
    public PageResult<ApprovalEntity> history(long page, long size) {
        Page<ApprovalEntity> result = approvalMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<ApprovalEntity>()
                        .in(ApprovalEntity::getStatus, List.of("APPROVED", "REJECTED"))
                        .orderByDesc(ApprovalEntity::getApproveAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /** 审批流配置（骨架：按业务类型给出层级） */
    public List<Map<String, Object>> config() {
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (String bizType : List.of("CERT", "RECALL", "QUOTA")) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("bizType", bizType);
            row.put("approveLevel", "CERT".equals(bizType) ? 2 : 1);
            result.add(row);
        }
        return result;
    }
}
