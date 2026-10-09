package com.agri.produce.internal.input;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 投入品档案（种子/肥料/农药/饲料/兽药） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class InputInfoService {

    private static final String ID_PREFIX = "INPT";

    private final InputInfoMapper inputInfoMapper;
    private final InputStockFlowMapper inputStockFlowMapper;

    /**
     * 分页查询。
     *
     * @param keyword inputName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<InputInfoEntity> page(long page, long size, String keyword, Integer status) {
        Page<InputInfoEntity> result = inputInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<InputInfoEntity>()
                        .like(keyword != null && !keyword.isBlank(), InputInfoEntity::getInputName, keyword)
                        .eq(status != null, InputInfoEntity::getStatus, status)
                        .orderByDesc(InputInfoEntity::getCreatedAt));
        fillNearestExpireDate(result.getRecords());
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public InputInfoEntity detail(String id) {
        InputInfoEntity entity = inputInfoMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        fillNearestExpireDate(List.of(entity));
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public InputInfoEntity create(InputInfoEntity entity) {
        if (entity.getInputId() == null || entity.getInputId().isBlank()) {
            entity.setInputId(ProduceIds.newId(ID_PREFIX));
        }
        inputInfoMapper.insert(entity);
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
    public InputInfoEntity update(String id, InputInfoEntity entity) {
        entity.setInputId(id);
        inputInfoMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        inputInfoMapper.deleteById(id);
    }

    /** 入库：写流水 + 增加库存 */
    @Transactional
    public InputInfoEntity stockIn(String inputId, BigDecimal qty, String batchNo,
                                   LocalDate expireDate, String operatorId) {
        InputInfoEntity input = detail(inputId);
        BigDecimal current = input.getStockQty() == null ? BigDecimal.ZERO : input.getStockQty();
        input.setStockQty(current.add(qty == null ? BigDecimal.ZERO : qty));
        inputInfoMapper.updateById(input);

        InputStockFlowEntity flow = new InputStockFlowEntity();
        flow.setFlowId(ProduceIds.newId("ISFL"));
        flow.setInputId(inputId);
        flow.setFlowType(1);
        flow.setQty(qty);
        flow.setBatchNo(batchNo);
        flow.setExpireDate(expireDate);
        flow.setOperatorId(operatorId);
        inputStockFlowMapper.insert(flow);
        return input;
    }

    /** 领用：写流水 + 扣减库存 */
    @Transactional
    public InputInfoEntity consume(String inputId, BigDecimal qty, String relatedTaskId, String operatorId) {
        InputInfoEntity input = detail(inputId);
        BigDecimal current = input.getStockQty() == null ? BigDecimal.ZERO : input.getStockQty();
        input.setStockQty(current.subtract(qty == null ? BigDecimal.ZERO : qty));
        inputInfoMapper.updateById(input);

        InputStockFlowEntity flow = new InputStockFlowEntity();
        flow.setFlowId(ProduceIds.newId("ISFL"));
        flow.setInputId(inputId);
        flow.setFlowType(2);
        flow.setQty(qty == null ? BigDecimal.ZERO : qty.negate());
        flow.setOperatorId(operatorId);
        flow.setRelatedTaskId(relatedTaskId);
        inputStockFlowMapper.insert(flow);
        return input;
    }

    /** 低库存预警清单 */
    public List<InputInfoEntity> warningList() {
        List<InputInfoEntity> list = inputInfoMapper.selectList(new LambdaQueryWrapper<InputInfoEntity>()
                .eq(InputInfoEntity::getStatus, 1)
                .isNotNull(InputInfoEntity::getWarnQty)
                .apply("stock_qty <= warn_qty"));
        fillNearestExpireDate(list);
        return list;
    }

    /** 库存总览：按剩余量升序，低库存置顶 */
    public List<InputInfoEntity> stockList() {
        List<InputInfoEntity> list = inputInfoMapper.selectList(new LambdaQueryWrapper<InputInfoEntity>()
                .eq(InputInfoEntity::getStatus, 1)
                .orderByAsc(InputInfoEntity::getStockQty));
        fillNearestExpireDate(list);
        return list;
    }

    /**
     * 批量回填「最近批次效期」（一次查询覆盖整页，避免 N+1）。
     *
     * <p>取值规则（与前端 {@code InputInfo.nearestExpireDate} 契约一致）：
     * <ol>
     *   <li>优先取该投入品<strong>最早的未过期</strong>效期；</li>
     *   <li>若全部批次均已过期，取<strong>最接近今天</strong>的那个过期日（即最晚的过期日）；</li>
     *   <li>无任何带效期的流水记录时为 {@code null}（不返回今天、不伪造日期）。</li>
     * </ol>
     * 效期源为 {@code prod_input_stock_flow.expire_date}。</p>
     *
     * @param inputs 待回填的投入品列表，可为空
     */
    private void fillNearestExpireDate(List<InputInfoEntity> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            return;
        }
        List<String> inputIds = inputs.stream()
                .map(InputInfoEntity::getInputId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        if (inputIds.isEmpty()) {
            return;
        }

        List<InputStockFlowEntity> flows = inputStockFlowMapper.selectList(
                new LambdaQueryWrapper<InputStockFlowEntity>()
                        .in(InputStockFlowEntity::getInputId, inputIds)
                        .isNotNull(InputStockFlowEntity::getExpireDate)
                        .select(InputStockFlowEntity::getInputId, InputStockFlowEntity::getExpireDate));

        LocalDate today = LocalDate.now();
        // 未过期批次中的最早效期
        Map<String, LocalDate> earliestValid = new HashMap<>();
        // 全部过期时，最接近今天的过期日（即最晚的过期日）
        Map<String, LocalDate> latestExpired = new HashMap<>();
        for (InputStockFlowEntity flow : flows) {
            String inputId = flow.getInputId();
            LocalDate expire = flow.getExpireDate();
            if (inputId == null || expire == null) {
                continue;
            }
            if (!expire.isBefore(today)) {
                earliestValid.merge(inputId, expire,
                        (oldVal, newVal) -> newVal.isBefore(oldVal) ? newVal : oldVal);
            } else {
                latestExpired.merge(inputId, expire,
                        (oldVal, newVal) -> newVal.isAfter(oldVal) ? newVal : oldVal);
            }
        }

        for (InputInfoEntity input : inputs) {
            LocalDate nearest = earliestValid.get(input.getInputId());
            if (nearest == null) {
                nearest = latestExpired.get(input.getInputId());
            }
            input.setNearestExpireDate(nearest);
        }
    }
}
