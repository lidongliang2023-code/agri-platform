package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.ChainRecord;
import com.agri.production.mapper.ChainRecordMapper;
import com.agri.production.service.IChainRecordService;
import com.agri.production.vo.ChainRecordContractVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ChainRecordServiceImpl implements IChainRecordService {

    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final ChainRecordMapper chainRecordMapper;

    public ChainRecordServiceImpl(ChainRecordMapper chainRecordMapper) {
        this.chainRecordMapper = chainRecordMapper;
    }

    @Override
    public PageResult<ChainRecordContractVO> page(int pageNum, int pageSize, String status, String bizType, String tenantId) {
        LambdaQueryWrapper<ChainRecord> w = new LambdaQueryWrapper<>();
        w.eq(ChainRecord::getTenantId, tenantId).eq(ChainRecord::getDelFlag, 0);
        if (status != null && !status.isBlank()) {
            w.eq(ChainRecord::getChainStatus, status.trim().toUpperCase());
        }
        if (bizType != null && !bizType.isBlank()) {
            w.eq(ChainRecord::getTargetType, bizType.trim().toUpperCase());
        }
        w.orderByDesc(ChainRecord::getCreateTime).orderByDesc(ChainRecord::getId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        IPage<ChainRecord> r = chainRecordMapper.selectPage(new Page<>(p, s), w);
        List<ChainRecordContractVO> list = new ArrayList<>();
        for (ChainRecord c : r.getRecords()) {
            list.add(ChainRecordContractVO.of(c));
        }
        return PageResult.of(list, r.getTotal(), p, s);
    }

    @Override
    public ChainRecordContractVO detail(Long recordId, String tenantId) {
        ChainRecord record = chainRecordMapper.selectById(recordId);
        if (record == null || !tenantId.equals(record.getTenantId())) {
            throw new BusinessException(404, "存证记录不存在：" + recordId);
        }
        return ChainRecordContractVO.of(record);
    }

    @Override
    public List<ChainRecordContractVO> listByBiz(String bizType, String bizId, String tenantId) {
        if (bizId == null || bizId.isBlank()) {
            throw new BusinessException(400, "缺少 bizId");
        }
        LambdaQueryWrapper<ChainRecord> w = new LambdaQueryWrapper<>();
        w.eq(ChainRecord::getTenantId, tenantId).eq(ChainRecord::getDelFlag, 0);
        if (bizType != null && !bizType.isBlank()) {
            w.eq(ChainRecord::getTargetType, bizType.trim().toUpperCase());
        }
        // bizId 在库里可能是 target_code（单号/码值）也可能是 target_id（数字主键），两边都认
        Long numeric = toLongOrNull(bizId);
        if (numeric != null) {
            w.and(q -> q.eq(ChainRecord::getTargetCode, bizId.trim()).or().eq(ChainRecord::getTargetId, numeric));
        } else {
            w.eq(ChainRecord::getTargetCode, bizId.trim());
        }
        w.orderByDesc(ChainRecord::getCreateTime);
        List<ChainRecordContractVO> list = new ArrayList<>();
        for (ChainRecord c : chainRecordMapper.selectList(w)) {
            list.add(ChainRecordContractVO.of(c));
        }
        return list;
    }

    @Override
    public Map<String, Object> overview(String tenantId) {
        List<ChainRecord> all = chainRecordMapper.selectList(new LambdaQueryWrapper<ChainRecord>()
                .eq(ChainRecord::getTenantId, tenantId).eq(ChainRecord::getDelFlag, 0));
        LocalDate today = LocalDate.now();
        String month = today.format(DateTimeFormatter.ofPattern("yyyy-MM"));
        long monthCount = 0;
        long success = 0;
        long latestHeight = 0;
        Map<String, Long> byDay = new LinkedHashMap<>();
        for (int i = 6; i >= 0; i--) {
            byDay.put(today.minusDays(i).format(DAY), 0L);
        }
        for (ChainRecord c : all) {
            if (STATUS_SUCCESS.equals(c.getChainStatus())) {
                success += 1;
            }
            if (c.getBlockNumber() != null && c.getBlockNumber() > latestHeight) {
                latestHeight = c.getBlockNumber();
            }
            if (c.getCreateTime() != null) {
                String day = c.getCreateTime().toInstant().atZone(java.time.ZoneId.systemDefault())
                        .toLocalDate().format(DAY);
                if (day.startsWith(month)) {
                    monthCount += 1;
                }
                if (byDay.containsKey(day)) {
                    byDay.put(day, byDay.get(day) + 1);
                }
            }
        }
        List<Map<String, Object>> trend = new ArrayList<>();
        byDay.forEach((day, count) -> {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", day);
            point.put("count", count);
            trend.add(point);
        });
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalRecords", all.size());
        result.put("monthRecords", monthCount);
        result.put("blockHeight", latestHeight);
        // 节点数没有来源（本部署不连真链）→ 给 0 而不是编一个
        result.put("nodeCount", 0);
        result.put("successRate", all.isEmpty() ? 0 : Math.round(success * 1000.0 / all.size()) / 10.0);
        result.put("trend", trend);
        return result;
    }

    private static Long toLongOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
