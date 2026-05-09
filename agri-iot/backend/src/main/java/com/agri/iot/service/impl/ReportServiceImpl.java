
package com.agri.iot.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.common.util.BeanCopyUtils;
import com.agri.iot.dto.ReportSaveDTO;
import com.agri.iot.entity.Report;
import com.agri.iot.mapper.ReportMapper;
import com.agri.iot.service.IReportService;
import com.agri.iot.vo.ReportVO;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements IReportService {

    private final ReportMapper reportMapper;
    private final ObjectMapper objectMapper;

    @Override
    public List<ReportVO> list() {
        return reportMapper.selectReportList(SecurityUtils.getTenantId());
    }

    @Override
    public ReportVO getById(Long id) {
        return reportMapper.selectReportById(id);
    }

    @Override
    @Transactional
    public void save(ReportSaveDTO dto) {
        Report report = new Report();
        report.setReportName(dto.getReportName());
        report.setReportCode("REPORT_" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        report.setDescription(dto.getDescription());
        report.setChartType(dto.getChartType());
        report.setTimeRange(dto.getTimeRange());
        report.setAggregationType(dto.getAggregationType());
        report.setTimeGranularity(dto.getTimeGranularity());
        report.setScheduledEnabled(dto.getScheduledEnabled());
        report.setScheduledType(dto.getScheduledType());
        report.setScheduledTime(dto.getScheduledTime());
        report.setEmailEnabled(dto.getEmailEnabled());
        report.setEmailRecipients(dto.getEmailRecipients());
        report.setPushEnabled(dto.getPushEnabled());
        report.setPushRecipients(dto.getPushRecipients());
        try {
            report.setConfigJson(objectMapper.writeValueAsString(dto.getDataSources()));
        } catch (JsonProcessingException e) {
            throw new BusinessException("配置JSON序列化失败");
        }
        report.setTenantId(SecurityUtils.getTenantId());
        report.setCreateBy(SecurityUtils.getUsername());
        report.setStatus(1);
        reportMapper.insert(report);
    }

    @Override
    @Transactional
    public void update(Long id, ReportSaveDTO dto) {
        Report report = new Report();
        report.setId(id);
        report.setReportName(dto.getReportName());
        report.setDescription(dto.getDescription());
        report.setChartType(dto.getChartType());
        report.setTimeRange(dto.getTimeRange());
        report.setAggregationType(dto.getAggregationType());
        report.setTimeGranularity(dto.getTimeGranularity());
        report.setScheduledEnabled(dto.getScheduledEnabled());
        report.setScheduledType(dto.getScheduledType());
        report.setScheduledTime(dto.getScheduledTime());
        report.setEmailEnabled(dto.getEmailEnabled());
        report.setEmailRecipients(dto.getEmailRecipients());
        report.setPushEnabled(dto.getPushEnabled());
        report.setPushRecipients(dto.getPushRecipients());
        if (dto.getDataSources() != null) {
            try {
                report.setConfigJson(objectMapper.writeValueAsString(dto.getDataSources()));
            } catch (JsonProcessingException e) {
                throw new BusinessException("配置JSON序列化失败");
            }
        }
        report.setUpdateBy(SecurityUtils.getUsername());
        reportMapper.update(report);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        ReportVO report = reportMapper.selectReportById(id);
        if (report == null) {
            throw new BusinessException("报表不存在");
        }
        reportMapper.deleteById(id);
    }

    @Override
    public void export(Long id) {
    }

    @Override
    public Object getData(Long id, String startTime, String endTime) {
        return null;
    }
}
