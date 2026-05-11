package com.agri.production.service;

import com.agri.production.dto.QualityInspectionQueryDTO;
import com.agri.production.dto.QualityInspectionSaveDTO;
import com.agri.production.entity.InspectionItem;
import com.agri.production.entity.QualityInspection;
import com.agri.production.common.entity.PageResult;

import java.util.List;
import java.util.Map;

public interface IQualityInspectionService {

    QualityInspection saveInspection(QualityInspectionSaveDTO dto, String tenantId);

    void deleteInspection(Long id);

    QualityInspection getInspectionById(Long id);

    PageResult<?> listInspections(QualityInspectionQueryDTO dto, String tenantId);

    void approveInspection(Long id, boolean approved, String remark);

    InspectionItem saveItem(InspectionItem item, String tenantId);

    void deleteItem(Long id);

    InspectionItem getItemById(Long id);

    List<InspectionItem> listItems(String tenantId);

    Map<String, Object> getInspectionStatistics(String tenantId);
}