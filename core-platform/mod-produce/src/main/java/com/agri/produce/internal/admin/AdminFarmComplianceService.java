package com.agri.produce.internal.admin;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 运营端：农场合规检查任务（PRD 6.2 #11）应用服务。
 *
 * <p>承接 {@code ComplianceCheck.tsx} 的「发起抽查 / 录入检查结果 / 整改跟踪」三类写操作，
 * 数据真落 {@code prod_farm_compliance_check}，不再降级到浏览器 localStorage。</p>
 *
 * <p>更新语义：PUT 传的是局部补丁（前端 {@code Partial<ComplianceTaskItem>}），
 * MyBatis-Plus 默认字段策略为 {@code NOT_NULL}，未出现的字段在实体里是 {@code null}，
 * 不会被写成空值覆盖库内既有数据。</p>
 */
@Service
@RequiredArgsConstructor
public class AdminFarmComplianceService {

    /** 新建任务尚未进入整改流程时的整改状态 */
    private static final String RECTIFY_STATUS_NONE = "none";

    /** 业务主键前缀，与前端 generateCheckId() 的 CHK 前缀保持一致 */
    private static final String ID_PREFIX = "CHK";

    private final FarmComplianceCheckMapper complianceCheckMapper;

    /**
     * 分页查询合规检查任务。
     *
     * @param page   页码
     * @param size   每页条数
     * @param farmId 农场ID过滤，可为空
     * @param result 检查结果过滤（1合规 2限期整改 3严重违规），可为空
     * @return 分页结果
     */
    public PageResult<FarmComplianceCheckEntity> page(long page, long size, String farmId, Integer result) {
        Page<FarmComplianceCheckEntity> queryResult = complianceCheckMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<FarmComplianceCheckEntity>()
                        .eq(farmId != null && !farmId.isBlank(), FarmComplianceCheckEntity::getFarmId, farmId)
                        .eq(result != null, FarmComplianceCheckEntity::getResult, result)
                        .orderByDesc(FarmComplianceCheckEntity::getCheckedAt)
                        .orderByDesc(FarmComplianceCheckEntity::getCheckId));
        return PageResult.of(queryResult.getRecords(), queryResult.getTotal(), page, size);
    }

    /**
     * 登记一条合规检查任务。
     *
     * <p>只补三类确属后端职责的默认值，其余字段一律保持前端传入的原值（含 {@code null}）：
     * 检查编号缺失时生成、检查时间缺失时取当前时间、整改状态缺失时置 {@code none}
     * （新建任务确实尚未进入整改流程，不是占位数据）。</p>
     *
     * @param entity 检查任务，farmId 必填
     * @return 落库后的实体
     */
    @Transactional
    public FarmComplianceCheckEntity create(FarmComplianceCheckEntity entity) {
        if (entity == null || entity.getFarmId() == null || entity.getFarmId().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST);
        }
        if (entity.getCheckId() == null || entity.getCheckId().isBlank()) {
            entity.setCheckId(ProduceIds.newId(ID_PREFIX));
        }
        if (entity.getCheckedAt() == null) {
            entity.setCheckedAt(LocalDateTime.now());
        }
        if (entity.getRectifyStatus() == null || entity.getRectifyStatus().isBlank()) {
            entity.setRectifyStatus(RECTIFY_STATUS_NONE);
        }
        complianceCheckMapper.insert(entity);
        return entity;
    }

    /**
     * 局部更新合规检查任务（录入检查结果 / 整改跟踪）。
     *
     * <p>库内不存在该编号时抛 {@code NOT_FOUND}：前端
     * {@code updateSupervisedComplianceTask} 会捕获并降级为本地登记，
     * 这正是「后端没有的历史本地数据不应静默变成空记录」的预期行为。</p>
     *
     * @param checkId 检查编号
     * @param patch   待更新字段（未出现的字段保持库内原值）
     * @return 更新后的实体
     */
    @Transactional
    public FarmComplianceCheckEntity update(String checkId, FarmComplianceCheckEntity patch) {
        if (complianceCheckMapper.selectById(checkId) == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        patch.setCheckId(checkId);
        complianceCheckMapper.updateById(patch);
        return complianceCheckMapper.selectById(checkId);
    }

    /**
     * 按编号查询单条检查任务，不存在返回 {@code null}。
     *
     * @param checkId 检查编号
     * @return 检查任务或 null
     */
    public FarmComplianceCheckEntity detail(String checkId) {
        return complianceCheckMapper.selectById(checkId);
    }
}
