package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminDistributionService;
import com.agri.admin.vo.DistributionDetailVO;
import com.agri.admin.vo.DistributionStatisticsVO;
import com.agri.admin.vo.DistributionTaskVO;
import com.agri.common.entity.PageResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminDistributionServiceImpl implements IAdminDistributionService {

    @Override
    public DistributionStatisticsVO getDistributionStatistics(String tenantId, String timeRange) {
        return DistributionStatisticsVO.builder()
                .totalTasks(100L)
                .successTasks(95L)
                .failedTasks(5L)
                .pendingTasks(0L)
                .distributionTrend(new ArrayList<>())
                .targetSystems(new ArrayList<>())
                .build();
    }

    @Override
    public PageResult<DistributionTaskVO> getDistributionTasks(Integer pageNum, Integer pageSize, String status, String targetSystem, String tenantId) {
        int offset = (pageNum - 1) * pageSize;
        List<DistributionTaskVO> list = new ArrayList<>();
        long total = 0;
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public DistributionDetailVO getDistributionDetail(Long id) {
        return DistributionDetailVO.builder()
                .id(id)
                .taskName("测试任务")
                .status("SUCCESS")
                .targetSystem("ERP")
                .targetUrl("http://localhost:8080")
                .recordCount(100)
                .successCount(100)
                .failedCount(0)
                .startTime("2024-01-01 10:00:00")
                .endTime("2024-01-01 10:01:00")
                .errorMessage("")
                .build();
    }

    @Override
    public void retryDistribution(Long id) {
    }

    @Override
    public void pauseDistribution(Long id) {
    }

    @Override
    public void resumeDistribution(Long id) {
    }

    @Override
    public List<DistributionStatisticsVO.DistributionTrend> getDistributionTrend(String timeRange) {
        return new ArrayList<>();
    }

    @Override
    public List<DistributionStatisticsVO.TargetSystem> getTargetSystems() {
        return new ArrayList<>();
    }

    @Override
    public byte[] exportDistributionLogs(String status, String startTime, String endTime) {
        return new byte[0];
    }
}