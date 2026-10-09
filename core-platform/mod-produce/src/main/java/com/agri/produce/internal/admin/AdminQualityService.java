package com.agri.produce.internal.admin;

import com.agri.produce.internal.harvest.HarvestBatchEntity;
import com.agri.produce.internal.harvest.HarvestBatchMapper;
import com.agri.produce.internal.quality.InspectionEntity;
import com.agri.produce.internal.quality.InspectionMapper;
import com.agri.produce.internal.quality.QualityLabEntity;
import com.agri.produce.internal.quality.QualityLabMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端：质量监管（检测机构资质、检测台账、不合格召回）。
 */
@Service
@RequiredArgsConstructor
public class AdminQualityService {

    private final QualityLabMapper qualityLabMapper;
    private final InspectionMapper inspectionMapper;
    private final HarvestBatchMapper harvestBatchMapper;

    /**
     * 检测机构分页。
     *
     * @param page    页码
     * @param size    每页条数
     * @param keyword 机构名称关键字
     * @return 分页结果
     */
    public PageResult<QualityLabEntity> pageLabs(long page, long size, String keyword) {
        Page<QualityLabEntity> result = qualityLabMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<QualityLabEntity>()
                        .like(keyword != null && !keyword.isBlank(), QualityLabEntity::getLabName, keyword)
                        .orderByDesc(QualityLabEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 检测台账分页。
     *
     * @param page   页码
     * @param size   每页条数
     * <p>筛选条件一律<strong>可选</strong>：列表接口强制要求筛选条件是后端设计缺陷，
     * 调用方（含前端）为了拿全量数据只能绕过条件，反而丢数据。缺失即不过滤。</p>
     *
     * @param page   页码
     * @param size   每页条数
     * @param result 结论过滤 PASS/FAIL，可为空
     * @param status 状态过滤 PENDING/TESTING/DONE，可为空
     * @return 分页结果
     */
    public PageResult<InspectionEntity> pageInspections(long page, long size, String result, String status) {
        Page<InspectionEntity> pageResult = inspectionMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InspectionEntity>()
                        .eq(result != null && !result.isBlank(), InspectionEntity::getResult, result)
                        .eq(status != null && !status.isBlank(), InspectionEntity::getStatus, status)
                        .orderByDesc(InspectionEntity::getSampleAt));
        return PageResult.of(pageResult.getRecords(), pageResult.getTotal(), page, size);
    }

    /**
     * 质量总览：合格率、不合格批次、机构数。
     *
     * @return 质量指标
     */
    public Map<String, Object> overview() {
        long pass = inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "PASS"));
        long fail = inspectionMapper.selectCount(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "FAIL"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("passCount", pass);
        result.put("failCount", fail);
        result.put("passRate", (pass + fail) == 0 ? 0 : pass * 100 / (pass + fail));
        result.put("labCount", qualityLabMapper.selectCount(new LambdaQueryWrapper<QualityLabEntity>()
                .eq(QualityLabEntity::getStatus, 1)));
        result.put("frozenBatch", harvestBatchMapper.selectCount(new LambdaQueryWrapper<HarvestBatchEntity>()
                .eq(HarvestBatchEntity::getStatus, 4)));
        return result;
    }

    /**
     * 检测机构资质认可（合作中）。
     *
     * @param labId 机构ID
     * @return 机构档案
     */
    @Transactional
    public QualityLabEntity accredit(String labId) {
        QualityLabEntity lab = qualityLabMapper.selectById(labId);
        if (lab == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        lab.setStatus(1);
        qualityLabMapper.updateById(lab);
        return lab;
    }

    /**
     * 检测机构准入驳回（终止合作）。
     *
     * <p>与 {@link #accredit(String)} 对称：认可置 {@code status=1}，驳回置 {@code status=0}。
     * 前端 {@code LabManage.tsx} 的 STATUS_VIEW 只有「1合作中 / 2待准入 / 0已终止」三态，
     * 驳回落到 0（已终止）——该页面原注释即为「驳回：本地置为已终止」，与此处语义一致。</p>
     *
     * <p>驳回原因可选：运营手填则落 {@code reject_reason}，未填写不覆盖历史值，
     * 但绝不会因为缺少端点而把用户输入丢掉。</p>
     *
     * @param labId   机构ID
     * @param request 驳回请求体（可为 null，表示无请求体调用）
     * @return 机构档案
     */
    @Transactional
    public QualityLabEntity reject(String labId, LabRejectRequest request) {
        QualityLabEntity lab = qualityLabMapper.selectById(labId);
        if (lab == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        lab.setStatus(0);
        if (request != null && request.getRejectReason() != null && !request.getRejectReason().isBlank()) {
            lab.setRejectReason(request.getRejectReason().trim());
        }
        qualityLabMapper.updateById(lab);
        return lab;
    }

    /**
     * 不合格召回：冻结关联批次。
     *
     * @param batchId 采收批次ID
     * @return 批次档案
     */
    @Transactional
    public HarvestBatchEntity recall(String batchId) {
        HarvestBatchEntity batch = harvestBatchMapper.selectById(batchId);
        if (batch == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        batch.setStatus(4);
        harvestBatchMapper.updateById(batch);
        return batch;
    }

    /**
     * 不合格检测清单。
     *
     * @return 检测记录
     */
    public List<InspectionEntity> listFailed() {
        return inspectionMapper.selectList(new LambdaQueryWrapper<InspectionEntity>()
                .eq(InspectionEntity::getResult, "FAIL")
                .orderByDesc(InspectionEntity::getSampleAt));
    }
}
