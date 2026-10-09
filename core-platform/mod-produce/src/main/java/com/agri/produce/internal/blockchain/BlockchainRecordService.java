package com.agri.produce.internal.blockchain;

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
 * 区块链存证记录（溯源关键数据锚定） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class BlockchainRecordService {

    private static final String ID_PREFIX = "CHN";

    private final BlockchainRecordMapper blockchainRecordMapper;

    /**
     * 分页查询。
     *
     * @param keyword bizNo 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<BlockchainRecordEntity> page(long page, long size, String keyword, String status) {
        Page<BlockchainRecordEntity> result = blockchainRecordMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<BlockchainRecordEntity>()
                        .like(keyword != null && !keyword.isBlank(), BlockchainRecordEntity::getBizNo, keyword)
                        .eq(status != null && !status.isBlank(), BlockchainRecordEntity::getStatus, status)
                        .orderByDesc(BlockchainRecordEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public BlockchainRecordEntity detail(String id) {
        BlockchainRecordEntity entity = blockchainRecordMapper.selectById(id);
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
    public BlockchainRecordEntity create(BlockchainRecordEntity entity) {
        if (entity.getRecordId() == null || entity.getRecordId().isBlank()) {
            entity.setRecordId(ProduceIds.newId(ID_PREFIX));
        }
        blockchainRecordMapper.insert(entity);
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
    public BlockchainRecordEntity update(String id, BlockchainRecordEntity entity) {
        entity.setRecordId(id);
        blockchainRecordMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        blockchainRecordMapper.deleteById(id);
    }

    /** 锚定上链：生成交易哈希并置为 SUCCESS（真实链路对接后置） */
    @Transactional
    public BlockchainRecordEntity anchor(BlockchainRecordEntity record) {
        if (record.getRecordId() == null || record.getRecordId().isBlank()) {
            record.setRecordId(ProduceIds.newId("CHN"));
        }
        record.setPayloadHash(record.getPayloadHash() == null
                ? "0x" + ProduceIds.newId("") : record.getPayloadHash());
        record.setTxHash("0x" + ProduceIds.newId(""));
        record.setBlockHeight(System.currentTimeMillis() / 1000);
        record.setAnchorAt(LocalDateTime.now());
        record.setStatus("SUCCESS");
        blockchainRecordMapper.insert(record);
        return record;
    }

    /** 按业务单号查询存证 */
    public List<BlockchainRecordEntity> listByBiz(String bizType, String bizNo) {
        return blockchainRecordMapper.selectList(new LambdaQueryWrapper<BlockchainRecordEntity>()
                .eq(bizType != null && !bizType.isBlank(), BlockchainRecordEntity::getBizType, bizType)
                .eq(bizNo != null && !bizNo.isBlank(), BlockchainRecordEntity::getBizNo, bizNo)
                .orderByDesc(BlockchainRecordEntity::getAnchorAt));
    }

    /** 存证校验 */
    public boolean verify(String txHash) {
        return blockchainRecordMapper.selectCount(new LambdaQueryWrapper<BlockchainRecordEntity>()
                .eq(BlockchainRecordEntity::getTxHash, txHash)
                .eq(BlockchainRecordEntity::getStatus, "SUCCESS")) > 0;
    }

    /** 存证总览 */
    public Map<String, Object> overview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", blockchainRecordMapper.selectCount(new LambdaQueryWrapper<BlockchainRecordEntity>()));
        result.put("success", blockchainRecordMapper.selectCount(new LambdaQueryWrapper<BlockchainRecordEntity>()
                .eq(BlockchainRecordEntity::getStatus, "SUCCESS")));
        result.put("failed", blockchainRecordMapper.selectCount(new LambdaQueryWrapper<BlockchainRecordEntity>()
                .eq(BlockchainRecordEntity::getStatus, "FAILED")));
        return result;
    }
}
