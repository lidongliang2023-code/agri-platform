package com.agri.produce.internal.harvest;

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
 * 采收作业记录（每次下地采收的原始登记） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class HarvestRecordService {

    private static final String ID_PREFIX = "HRVD";

    private final HarvestRecordMapper harvestRecordMapper;

    /**
     * 分页查询。
     *
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<HarvestRecordEntity> page(long page, long size, Integer status) {
        Page<HarvestRecordEntity> result = harvestRecordMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<HarvestRecordEntity>()
                        .eq(status != null, HarvestRecordEntity::getStatus, status)
                        .orderByDesc(HarvestRecordEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public HarvestRecordEntity detail(String id) {
        HarvestRecordEntity entity = harvestRecordMapper.selectById(id);
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
    public HarvestRecordEntity create(HarvestRecordEntity entity) {
        if (entity.getRecordId() == null || entity.getRecordId().isBlank()) {
            entity.setRecordId(ProduceIds.newId(ID_PREFIX));
        }
        harvestRecordMapper.insert(entity);
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
    public HarvestRecordEntity update(String id, HarvestRecordEntity entity) {
        entity.setRecordId(id);
        harvestRecordMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        harvestRecordMapper.deleteById(id);
    }

    /**
     * 地块采收流水。
     *
     * <p><b>为什么 plotId 为空时不加条件。</b>此前实现把入参直接塞进
     * {@code eq(..., plotId)}，调用方不传（或传空串）时拼成
     * {@code WHERE plot_id = ''}，库内没有任何记录命中，接口静默返回 0 条——
     * 比报错更糟，因为它把「没查到」伪装成「确实没有采收记录」。
     * 本项目口径：<b>空值一律表示「不过滤」，禁止把 null 转成空串再透传。</b>
     *
     * @param plotId 地块号，null/空白表示不过滤
     * @return 采收记录列表
     */
    public List<HarvestRecordEntity> listByPlot(String plotId) {
        boolean filterByPlot = plotId != null && !plotId.isBlank();
        return harvestRecordMapper.selectList(new LambdaQueryWrapper<HarvestRecordEntity>()
                .eq(filterByPlot, HarvestRecordEntity::getPlotId, filterByPlot ? plotId.trim() : null)
                .orderByDesc(HarvestRecordEntity::getHarvestDate));
    }

    /**
     * 采收计划分页查询（按地块聚合采收记录，可不带地块）。
     *
     * <p><b>为什么必须返回 PageResult 而不是裸 List。</b>前端
     * {@code src/api/harvests.ts queryHarvestPlans} 按 {@code PageResult<HarvestPlan>}
     * 解构（响应拦截器 {@code normalizePageData} 再把 {@code records} 归一化为
     * {@code list}），后端吐裸数组时 {@code response.data.records/total} 取不到，
     * 列表恒为空，进而落入 demoStore 的演示数据兜底——用户看到的是假数据。
     *
     * <p><b>为什么没有 farmId 入参。</b>{@code prod_harvest_record} 表<b>没有
     * farm_id 列</b>（列是 record_id / market_id / tenant_id / plot_id / plan_id /
     * crop_id / crop_variety / harvest_date / quantity / unit / grade / operator_id /
     * weather / remark / status）。前端曾传 {@code farmId}，后端无法按农场过滤，
     * 此处不接该参数，避免「接了参数但永远不生效」的假功能。地块维度的农场归属
     * 需联查 {@code prod_plot_info}，本轮不做。
     *
     * @param page   页码
     * @param size   每页条数
     * @param plotId 地块号，null/空白表示不过滤
     * @return 分页结果
     */
    public PageResult<HarvestRecordEntity> pageByPlot(long page, long size, String plotId) {
        boolean filterByPlot = plotId != null && !plotId.isBlank();
        Page<HarvestRecordEntity> result = harvestRecordMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<HarvestRecordEntity>()
                        .eq(filterByPlot, HarvestRecordEntity::getPlotId, filterByPlot ? plotId.trim() : null)
                        .orderByDesc(HarvestRecordEntity::getHarvestDate));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /** 区间采收总量 */
    public Map<String, Object> sumByPlot(String plotId) {
        List<HarvestRecordEntity> list = listByPlot(plotId);
        BigDecimal total = BigDecimal.ZERO;
        for (HarvestRecordEntity record : list) {
            if (record.getQuantity() != null) {
                total = total.add(record.getQuantity());
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recordCount", list.size());
        result.put("quantityTotal", total);
        return result;
    }
}
