package com.agri.production.service.impl;

import com.agri.production.dto.QualityInspectionQueryDTO;
import com.agri.production.dto.QualityInspectionSaveDTO;
import com.agri.production.entity.InspectionItem;
import com.agri.production.entity.QualityInspection;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.InspectionItemMapper;
import com.agri.production.mapper.QualityInspectionMapper;
import com.agri.production.service.IQualityInspectionService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class QualityInspectionServiceImpl implements IQualityInspectionService {

    private final QualityInspectionMapper qualityInspectionMapper;
    private final InspectionItemMapper inspectionItemMapper;

    public QualityInspectionServiceImpl(QualityInspectionMapper qualityInspectionMapper, InspectionItemMapper inspectionItemMapper) {
        this.qualityInspectionMapper = qualityInspectionMapper;
        this.inspectionItemMapper = inspectionItemMapper;
    }

    @Override
    @Transactional
    public QualityInspection saveInspection(QualityInspectionSaveDTO dto, String tenantId) {
        QualityInspection inspection = BeanCopyUtils.copy(dto, QualityInspection.class);
        inspection.setTenantId(tenantId);
        if (inspection.getId() == null) {
            inspection.setInspectionCode("INS" + System.currentTimeMillis());
            inspection.setInspectionDate(LocalDateTime.now());
            inspection.setStatus("pending");
            qualityInspectionMapper.insert(inspection);
        } else {
            qualityInspectionMapper.updateById(inspection);
        }
        return inspection;
    }

    @Override
    @Transactional
    public void deleteInspection(Long id) {
        qualityInspectionMapper.deleteById(id);
    }

    @Override
    public QualityInspection getInspectionById(Long id) {
        return qualityInspectionMapper.selectById(id);
    }

    @Override
    public PageResult<?> listInspections(QualityInspectionQueryDTO dto, String tenantId) {
        Page<QualityInspection> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<QualityInspection> result = qualityInspectionMapper.pageQuery(page, dto, tenantId);
        return PageResult.of(result.getRecords(), result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    @Transactional
    public void approveInspection(Long id, boolean approved, String remark) {
        QualityInspection inspection = qualityInspectionMapper.selectById(id);
        if (inspection != null) {
            inspection.setStatus(approved ? "approved" : "rejected");
            inspection.setIsQualified(approved ? 1 : 0);
            if (!approved) {
                inspection.setUnqualifiedReason(remark);
            }
            qualityInspectionMapper.updateById(inspection);
        }
    }

    @Override
    @Transactional
    public InspectionItem saveItem(InspectionItem item, String tenantId) {
        item.setTenantId(tenantId);
        if (item.getId() == null) {
            item.setItemCode("ITEM" + System.currentTimeMillis());
            item.setCreateTime(LocalDateTime.now());
            inspectionItemMapper.insert(item);
        } else {
            item.setUpdateTime(LocalDateTime.now());
            inspectionItemMapper.updateById(item);
        }
        return item;
    }

    @Override
    @Transactional
    public void deleteItem(Long id) {
        inspectionItemMapper.deleteById(id);
    }

    @Override
    public InspectionItem getItemById(Long id) {
        return inspectionItemMapper.selectById(id);
    }

    @Override
    public List<InspectionItem> listItems(String tenantId) {
        return inspectionItemMapper.selectList(null);
    }

    @Override
    public Map<String, Object> getInspectionStatistics(String tenantId) {
        Map<String, Object> result = new HashMap<>();
        result.put("total", qualityInspectionMapper.selectCount(null));
        result.put("qualified", qualityInspectionMapper.countByQualified(1, tenantId));
        result.put("unqualified", qualityInspectionMapper.countByQualified(0, tenantId));
        return result;
    }
}