package com.agri.production.service.impl;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.DomainEventRecord;
import com.agri.production.mapper.DomainEventMapper;
import com.agri.production.service.IDomainEventOpsService;
import com.agri.production.vo.DomainEventContractVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DomainEventOpsServiceImpl implements IDomainEventOpsService {

    private final DomainEventMapper eventMapper;

    public DomainEventOpsServiceImpl(DomainEventMapper eventMapper) {
        this.eventMapper = eventMapper;
    }

    @Override
    public PageResult<DomainEventContractVO> page(String status, int pageNum, int pageSize, String tenantId) {
        LambdaQueryWrapper<DomainEventRecord> wrapper = scoped(tenantId);
        if (status != null && !status.isBlank()) {
            wrapper.eq(DomainEventRecord::getStatus, status.trim().toUpperCase());
        }
        wrapper.orderByDesc(DomainEventRecord::getId);
        Page<DomainEventRecord> result = eventMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<DomainEventContractVO> records = result.getRecords().stream()
                .map(DomainEventContractVO::of).toList();
        return PageResult.of(records, result.getTotal(), pageNum, pageSize);
    }

    @Override
    public Map<String, Object> summary(String tenantId) {
        // 三个状态**逐个查**而不是"总数减一下"：NEW 的口径里含 next_retry_at 未到期的，
        // 用减法会算出一个既不是"待投"也不是"已发"的第四个数，没有意义。
        Map<String, Object> result = new LinkedHashMap<>();
        long pending = count(DomainEventRecord.STATUS_NEW, tenantId);
        long sent = count(DomainEventRecord.STATUS_SENT, tenantId);
        long dead = count(DomainEventRecord.STATUS_DEAD, tenantId);
        result.put("pending", pending);
        result.put("sent", sent);
        result.put("dead", dead);
        result.put("total", pending + sent + dead);
        return result;
    }

    @Override
    public DomainEventContractVO replay(Long id, String tenantId) {
        DomainEventRecord record = eventMapper.selectOne(scoped(tenantId).eq(DomainEventRecord::getId, id));
        if (record == null) {
            throw new BusinessException(404, "事件不存在：" + id);
        }
        if (DomainEventRecord.STATUS_NEW.equals(record.getStatus())) {
            throw new BusinessException(400, "该事件仍在待投递队列中，无需重放");
        }
        // 重放 = 放回队列，并把重试计数与失败原因清零；不预置 next_retry_at，
        // 让中继在下一次轮询（最长一个间隔）就捡起来。
        eventMapper.update(null, new UpdateWrapper<DomainEventRecord>()
                .eq("id", id)
                .set("status", DomainEventRecord.STATUS_NEW)
                .set("retry_count", 0)
                .set("next_retry_at", null)
                .set("last_error", null)
                .set("sent_at", null));
        return DomainEventContractVO.of(eventMapper.selectById(id));
    }

    private long count(String status, String tenantId) {
        Long hits = eventMapper.selectCount(scoped(tenantId).eq(DomainEventRecord::getStatus, status));
        return hits == null ? 0L : hits;
    }

    private LambdaQueryWrapper<DomainEventRecord> scoped(String tenantId) {
        return new LambdaQueryWrapper<DomainEventRecord>().eq(DomainEventRecord::getTenantId, tenantId);
    }
}
