package com.agri.admin.service;

import com.agri.admin.vo.QualityDetailVO;
import com.agri.admin.vo.QualityIssueVO;
import com.agri.admin.vo.QualityStatisticsVO;
import com.agri.common.entity.PageResult;

import java.util.List;

public interface IAdminQualityService {

    QualityStatisticsVO getQualityStatistics(String tenantId, String timeRange);

    PageResult<QualityIssueVO> getQualityIssues(Integer pageNum, Integer pageSize, String severity, String domain, String status, String tenantId);

    QualityDetailVO getQualityDetail(Long id);

    void handleQualityIssue(Long id, String status, String remark);

    void batchHandleQualityIssues(List<Long> ids, String status, String remark);

    List<QualityStatisticsVO.QualityTrend> getQualityTrend(String timeRange, String domain);

    byte[] exportQualityIssues(String severity, String status);
}