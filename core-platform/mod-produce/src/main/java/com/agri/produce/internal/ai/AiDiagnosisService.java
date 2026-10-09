package com.agri.produce.internal.ai;

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
 * AI 诊断记录（病虫害/长势/成熟度识别） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class AiDiagnosisService {

    private static final String ID_PREFIX = "AIDG";

    private final AiDiagnosisMapper aiDiagnosisMapper;

    /**
     * 分页查询。
     *
     * @param keyword cropName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<AiDiagnosisEntity> page(long page, long size, String keyword, String status) {
        Page<AiDiagnosisEntity> result = aiDiagnosisMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AiDiagnosisEntity>()
                        .like(keyword != null && !keyword.isBlank(), AiDiagnosisEntity::getCropName, keyword)
                        .eq(status != null && !status.isBlank(), AiDiagnosisEntity::getStatus, status)
                        .orderByDesc(AiDiagnosisEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public AiDiagnosisEntity detail(String id) {
        AiDiagnosisEntity entity = aiDiagnosisMapper.selectById(id);
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
    public AiDiagnosisEntity create(AiDiagnosisEntity entity) {
        if (entity.getDiagnosisId() == null || entity.getDiagnosisId().isBlank()) {
            entity.setDiagnosisId(ProduceIds.newId(ID_PREFIX));
        }
        aiDiagnosisMapper.insert(entity);
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
    public AiDiagnosisEntity update(String id, AiDiagnosisEntity entity) {
        entity.setDiagnosisId(id);
        aiDiagnosisMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        aiDiagnosisMapper.deleteById(id);
    }

    /** 发起诊断：登记请求并置 SUCCESS（真实推理经 satellite-ai-gateway） */
    @Transactional
    public AiDiagnosisEntity diagnose(AiDiagnosisEntity diagnosis) {
        if (diagnosis.getDiagnosisId() == null || diagnosis.getDiagnosisId().isBlank()) {
            diagnosis.setDiagnosisId(ProduceIds.newId("AIDG"));
        }
        if (diagnosis.getConfidence() == null) {
            diagnosis.setConfidence(BigDecimal.ZERO);
        }
        diagnosis.setDiagnosedAt(LocalDateTime.now());
        diagnosis.setStatus("SUCCESS");
        aiDiagnosisMapper.insert(diagnosis);
        return diagnosis;
    }

    /** 地块历史诊断 */
    public List<AiDiagnosisEntity> listByPlot(String plotId) {
        return aiDiagnosisMapper.selectList(new LambdaQueryWrapper<AiDiagnosisEntity>()
                .eq(AiDiagnosisEntity::getPlotId, plotId)
                .orderByDesc(AiDiagnosisEntity::getDiagnosedAt));
    }

    /** 会话摘要（按地块/全局取历史诊断） */
    public List<Map<String, Object>> sessions(String plotId) {
        List<AiDiagnosisEntity> list = plotId == null || plotId.isBlank()
                ? aiDiagnosisMapper.selectList(new LambdaQueryWrapper<AiDiagnosisEntity>()
                        .orderByDesc(AiDiagnosisEntity::getDiagnosedAt).last("LIMIT 50"))
                : listByPlot(plotId);
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (AiDiagnosisEntity item : list) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("sessionId", item.getDiagnosisId());
            row.put("plotId", item.getPlotId());
            row.put("diagnosisType", item.getDiagnosisType());
            row.put("resultLabel", item.getResultLabel());
            row.put("confidence", item.getConfidence());
            row.put("diagnosedAt", item.getDiagnosedAt());
            result.add(row);
        }
        return result;
    }

    /** 产量预测（骨架：按样本量给出参考值，模型能力在 satellite-ai-gateway） */
    public Map<String, Object> yieldForecast(String plotId) {
        List<AiDiagnosisEntity> list = plotId == null || plotId.isBlank()
                ? aiDiagnosisMapper.selectList(new LambdaQueryWrapper<AiDiagnosisEntity>())
                : listByPlot(plotId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("plotId", plotId);
        result.put("sampleCount", list.size());
        result.put("forecastYield", BigDecimal.valueOf(list.size() * 100L));
        result.put("unit", "kg");
        return result;
    }
}
