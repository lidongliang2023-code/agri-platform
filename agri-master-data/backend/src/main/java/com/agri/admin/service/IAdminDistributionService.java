package com.agri.admin.service;

import com.agri.admin.vo.DistributionDetailVO;
import com.agri.admin.vo.DistributionStatisticsVO;
import com.agri.admin.vo.DistributionTaskVO;
import com.agri.common.entity.PageResult;

import java.util.List;

public interface IAdminDistributionService {

    DistributionStatisticsVO getDistributionStatistics(String tenantId, String timeRange);

    /** keyword 匹配任务编码 / 任务名称（页面顶部有一个搜索框，原接口没这个参数，搜索点了没反应） */
    PageResult<DistributionTaskVO> getDistributionTasks(Integer pageNum, Integer pageSize, String status, String targetSystem, String tenantId, String keyword);

    DistributionDetailVO getDistributionDetail(Long id);

    void retryDistribution(Long id);

    void pauseDistribution(Long id);

    void resumeDistribution(Long id);

    List<DistributionStatisticsVO.DistributionTrend> getDistributionTrend(String timeRange);

    List<DistributionStatisticsVO.TargetSystem> getTargetSystems();

    byte[] exportDistributionLogs(String status, String startTime, String endTime);
}
