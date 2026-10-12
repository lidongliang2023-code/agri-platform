package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminDistributionService;
import com.agri.admin.vo.DistributionDetailVO;
import com.agri.admin.vo.DistributionStatisticsVO;
import com.agri.admin.vo.DistributionTaskVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.DistributionTask;
import com.agri.masterdata.mapper.DistributionTaskMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 数据分发。
 *
 * <p>本类原来八个方法全是空壳：统计是 builder 写死的数字、任务列表恒返回空数组、
 * 重试/暂停/恢复是空方法体、导出返回空字节数组。分发页因此永远看不到数据。
 * 现在全部落到 {@code agri_md_distribution_task}。</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AdminDistributionServiceImpl implements IAdminDistributionService {

    private final DistributionTaskMapper distributionTaskMapper;

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Override
    public DistributionStatisticsVO getDistributionStatistics(String tenantId, String timeRange) {
        List<DistributionTask> all = distributionTaskMapper.selectList(buildFilter(null, null, tenantId));

        DistributionStatisticsVO vo = new DistributionStatisticsVO();
        vo.setTotalTasks((long) all.size());
        vo.setSuccessTasks(all.stream().filter(t -> "success".equals(t.getStatus())).count());
        vo.setFailedTasks(all.stream().filter(t -> "failed".equals(t.getStatus())).count());
        vo.setPendingTasks(all.stream()
                .filter(t -> "pending".equals(t.getStatus()) || "running".equals(t.getStatus())).count());

        long totalRecords = 0;
        long successRecords = 0;
        long failedRecords = 0;
        double delaySum = 0;
        int delayCount = 0;
        long todayCount = 0;
        LocalDate today = LocalDate.now();

        for (DistributionTask task : all) {
            totalRecords += nz(task.getTotalCount());
            successRecords += nz(task.getSuccessCount());
            failedRecords += nz(task.getFailedCount());
            if (task.getDelay() != null) {
                delaySum += task.getDelay();
                delayCount++;
            }
            if (task.getStartTime() != null && today.equals(task.getStartTime().toLocalDate())) {
                todayCount++;
            }
        }

        vo.setTotalDistributions(totalRecords);
        vo.setSuccessCount(successRecords);
        vo.setFailedCount(failedRecords);
        vo.setPendingCount(Math.max(0, totalRecords - successRecords - failedRecords));
        vo.setSuccessRate(totalRecords == 0 ? null
                : Math.round(successRecords * 10000.0 / totalRecords) / 100.0);
        vo.setAvgDelay(delayCount == 0 ? null : Math.round(delaySum * 100.0 / delayCount) / 100.0);
        vo.setTodayDistribution(todayCount);
        vo.setTargetSystems(buildTargetSystems(all));
        vo.setDistributionTrend(getDistributionTrend(timeRange));
        return vo;
    }

    @Override
    public PageResult<DistributionTaskVO> getDistributionTasks(Integer pageNum, Integer pageSize, String status,
                                                               String targetSystem, String tenantId, String keyword) {
        LambdaQueryWrapper<DistributionTask> wrapper = buildFilter(status, targetSystem, tenantId);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(DistributionTask::getTaskCode, keyword)
                    .or().like(DistributionTask::getTaskName, keyword));
        }
        wrapper.orderByDesc(DistributionTask::getStartTime).orderByDesc(DistributionTask::getId);

        IPage<DistributionTask> page = distributionTaskMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<DistributionTaskVO> list = new ArrayList<>();
        for (DistributionTask task : page.getRecords()) {
            list.add(toTaskVO(task));
        }
        return PageResult.success(list, page.getTotal(), pageNum, pageSize);
    }

    @Override
    public DistributionDetailVO getDistributionDetail(Long id) {
        DistributionTask task = distributionTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException("分发任务不存在");
        }

        DistributionDetailVO vo = new DistributionDetailVO();
        vo.setId(task.getId());
        vo.setTaskCode(task.getTaskCode());
        vo.setTaskName(task.getTaskName());
        vo.setTargetSystem(task.getTargetSystem());
        vo.setTargetSystemName(task.getTargetSystemName());
        vo.setDataType(task.getDataType());
        vo.setDataTypeName(task.getDataTypeName());
        vo.setStatus(task.getStatus());
        vo.setTotalCount(task.getTotalCount());
        vo.setRecordCount(task.getTotalCount());
        vo.setSuccessCount(task.getSuccessCount());
        vo.setFailedCount(task.getFailedCount());
        vo.setDelay(task.getDelay());
        vo.setTenantId(task.getTenantId());
        vo.setTenantName(task.getTenantName());
        vo.setCreateTime(fmt(task.getCreateTime()));
        vo.setStartTime(fmt(task.getStartTime()));
        vo.setEndTime(fmt(task.getEndTime()));
        vo.setErrorMessage(task.getErrorMessage());

        // 分发日志没有独立的表，这里由任务自身的时间戳与失败原因拼出可核对的几条 ——
        // 每一行都来自真实字段，不编造"某时刻重试第 N 次"这类不存在的过程。
        List<DistributionDetailVO.DistributionLog> logs = new ArrayList<>();
        if (task.getStartTime() != null) {
            logs.add(logOf(fmt(task.getStartTime()), "INFO", "任务开始执行"));
        }
        if (nz(task.getSuccessCount()) > 0) {
            logs.add(logOf(fmt(task.getEndTime() != null ? task.getEndTime() : task.getStartTime()),
                    "INFO", "成功分发 " + task.getSuccessCount() + " 条"));
        }
        if (nz(task.getFailedCount()) > 0) {
            logs.add(logOf(fmt(task.getEndTime() != null ? task.getEndTime() : task.getStartTime()),
                    "ERROR", "失败 " + task.getFailedCount() + " 条"
                            + (task.getErrorMessage() == null ? "" : "：" + task.getErrorMessage())));
        }
        if (task.getEndTime() != null) {
            logs.add(logOf(fmt(task.getEndTime()), "INFO", "任务结束"));
        }
        vo.setLogs(logs);
        return vo;
    }

    @Override
    @Transactional
    public void retryDistribution(Long id) {
        DistributionTask task = distributionTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException("分发任务不存在");
        }
        if (!"failed".equals(task.getStatus())) {
            throw new BusinessException("只有失败的任务才能重试");
        }
        // 重试 = 把这条任务重新置为执行中并清掉上一次的失败信息。
        // 真实的重新推送需要分发引擎，当前没有 —— 所以只做状态流转，不假装"已重推成功"。
        task.setStatus("running");
        task.setProgress(0);
        task.setFailedCount(0);
        task.setErrorMessage(null);
        task.setStartTime(LocalDateTime.now());
        task.setEndTime(null);
        distributionTaskMapper.updateById(task);
        log.info("分发任务重试：id={} code={}", id, task.getTaskCode());
    }

    @Override
    @Transactional
    public void pauseDistribution(Long id) {
        DistributionTask task = distributionTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException("分发任务不存在");
        }
        if (!"running".equals(task.getStatus())) {
            throw new BusinessException("只有执行中的任务才能暂停");
        }
        task.setStatus("paused");
        distributionTaskMapper.updateById(task);
    }

    @Override
    @Transactional
    public void resumeDistribution(Long id) {
        DistributionTask task = distributionTaskMapper.selectById(id);
        if (task == null) {
            throw new BusinessException("分发任务不存在");
        }
        if (!"paused".equals(task.getStatus())) {
            throw new BusinessException("只有已暂停的任务才能恢复");
        }
        task.setStatus("running");
        distributionTaskMapper.updateById(task);
    }

    @Override
    public List<DistributionStatisticsVO.DistributionTrend> getDistributionTrend(String timeRange) {
        int days = parseDays(timeRange);
        LocalDate from = LocalDate.now().minusDays(days - 1L);

        Map<String, long[]> buckets = new LinkedHashMap<>();
        for (int i = 0; i < days; i++) {
            buckets.put(from.plusDays(i).format(DATE_FMT), new long[]{0L, 0L, 0L});
        }
        for (DistributionTask task : distributionTaskMapper.selectList(new LambdaQueryWrapper<>())) {
            if (task.getStartTime() == null) {
                continue;
            }
            long[] bucket = buckets.get(task.getStartTime().toLocalDate().format(DATE_FMT));
            if (bucket == null) {
                continue;
            }
            bucket[0] += nz(task.getTotalCount());
            bucket[1] += nz(task.getSuccessCount());
            bucket[2] += nz(task.getFailedCount());
        }

        List<DistributionStatisticsVO.DistributionTrend> trends = new ArrayList<>();
        for (Map.Entry<String, long[]> entry : buckets.entrySet()) {
            DistributionStatisticsVO.DistributionTrend trend = new DistributionStatisticsVO.DistributionTrend();
            trend.setDate(entry.getKey());
            trend.setTotalDistributions(entry.getValue()[0]);
            trend.setSuccessCount(entry.getValue()[1]);
            trend.setFailedCount(entry.getValue()[2]);
            trend.setAvgDelay(null);
            trends.add(trend);
        }
        return trends;
    }

    @Override
    public List<DistributionStatisticsVO.TargetSystem> getTargetSystems() {
        return buildTargetSystems(distributionTaskMapper.selectList(new LambdaQueryWrapper<>()));
    }

    @Override
    public byte[] exportDistributionLogs(String status, String startTime, String endTime) {
        LambdaQueryWrapper<DistributionTask> wrapper = buildFilter(status, null, null);
        wrapper.orderByDesc(DistributionTask::getStartTime);

        StringBuilder csv = new StringBuilder();
        csv.append("任务编码,任务名称,目标系统,数据类型,触发方式,状态,总数,成功,失败,进度,耗时(秒),开始时间,失败原因\n");
        for (DistributionTask task : distributionTaskMapper.selectList(wrapper)) {
            csv.append(cell(task.getTaskCode())).append(',')
                    .append(cell(task.getTaskName())).append(',')
                    .append(cell(task.getTargetSystemName())).append(',')
                    .append(cell(task.getDataTypeName())).append(',')
                    .append(cell(task.getTriggerType())).append(',')
                    .append(cell(task.getStatus())).append(',')
                    .append(nz(task.getTotalCount())).append(',')
                    .append(nz(task.getSuccessCount())).append(',')
                    .append(nz(task.getFailedCount())).append(',')
                    .append(nz(task.getProgress())).append(',')
                    .append(task.getDelay() == null ? "" : task.getDelay()).append(',')
                    .append(fmt(task.getStartTime())).append(',')
                    .append(cell(task.getErrorMessage()))
                    .append('\n');
        }
        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[body.length + 3];
        withBom[0] = (byte) 0xEF;
        withBom[1] = (byte) 0xBB;
        withBom[2] = (byte) 0xBF;
        System.arraycopy(body, 0, withBom, 3, body.length);
        return withBom;
    }

    /* --------------------------------- 内部方法 --------------------------------- */

    private LambdaQueryWrapper<DistributionTask> buildFilter(String status, String targetSystem, String tenantId) {
        LambdaQueryWrapper<DistributionTask> wrapper = new LambdaQueryWrapper<>();
        if (status != null && !status.isEmpty()) {
            wrapper.eq(DistributionTask::getStatus, status);
        }
        if (targetSystem != null && !targetSystem.isEmpty()) {
            wrapper.and(w -> w.eq(DistributionTask::getTargetSystem, targetSystem)
                    .or().eq(DistributionTask::getTargetSystemName, targetSystem));
        }
        if (tenantId != null && !tenantId.isEmpty()) {
            wrapper.eq(DistributionTask::getTenantId, tenantId);
        }
        return wrapper;
    }

    private List<DistributionStatisticsVO.TargetSystem> buildTargetSystems(List<DistributionTask> tasks) {
        Map<String, DistributionStatisticsVO.TargetSystem> grouped = new HashMap<>();
        Map<String, Long> successSum = new HashMap<>();
        Map<String, Long> totalSum = new HashMap<>();
        Map<String, Double> delaySum = new HashMap<>();
        Map<String, Integer> delayCount = new HashMap<>();

        for (DistributionTask task : tasks) {
            String code = task.getTargetSystem() == null ? "unknown" : task.getTargetSystem();
            if (!grouped.containsKey(code)) {
                DistributionStatisticsVO.TargetSystem item = new DistributionStatisticsVO.TargetSystem();
                item.setSystemCode(code);
                item.setSystemName(task.getTargetSystemName());
                item.setStatus("healthy");
                grouped.put(code, item);
                successSum.put(code, 0L);
                totalSum.put(code, 0L);
                delaySum.put(code, 0.0);
                delayCount.put(code, 0);
            }
            totalSum.put(code, totalSum.get(code) + nz(task.getTotalCount()));
            successSum.put(code, successSum.get(code) + nz(task.getSuccessCount()));
            if (task.getDelay() != null) {
                delaySum.put(code, delaySum.get(code) + task.getDelay());
                delayCount.put(code, delayCount.get(code) + 1);
            }
        }

        List<DistributionStatisticsVO.TargetSystem> list = new ArrayList<>();
        for (Map.Entry<String, DistributionStatisticsVO.TargetSystem> entry : grouped.entrySet()) {
            String code = entry.getKey();
            DistributionStatisticsVO.TargetSystem item = entry.getValue();
            long total = totalSum.get(code);
            item.setTotalDistributions(total);
            item.setSuccessRate(total == 0 ? null : Math.round(successSum.get(code) * 10000.0 / total) / 100.0);
            item.setAvgDelay(delayCount.get(code) == 0 ? null
                    : Math.round(delaySum.get(code) * 100.0 / delayCount.get(code)) / 100.0);
            list.add(item);
        }
        return list;
    }

    private DistributionDetailVO.DistributionLog logOf(String time, String level, String message) {
        DistributionDetailVO.DistributionLog entry = new DistributionDetailVO.DistributionLog();
        entry.setTime(time);
        entry.setLevel(level);
        entry.setMessage(message);
        return entry;
    }

    private DistributionTaskVO toTaskVO(DistributionTask task) {
        DistributionTaskVO vo = new DistributionTaskVO();
        vo.setId(task.getId());
        vo.setTaskCode(task.getTaskCode());
        vo.setTaskName(task.getTaskName());
        vo.setTargetSystem(task.getTargetSystem());
        vo.setTargetSystemName(task.getTargetSystemName());
        vo.setDataType(task.getDataType());
        vo.setDataTypeName(task.getDataTypeName());
        vo.setTriggerType(task.getTriggerType());
        vo.setStatus(task.getStatus());
        // VO 的这三个字段是 Integer（不是 Long），直接透传实体值
        vo.setTotalCount(task.getTotalCount());
        vo.setSuccessCount(task.getSuccessCount());
        vo.setFailedCount(task.getFailedCount());
        vo.setProgress(task.getProgress());
        vo.setDelay(task.getDelay());
        vo.setTenantId(task.getTenantId());
        vo.setTenantName(task.getTenantName());
        vo.setCreateTime(fmt(task.getCreateTime()));
        vo.setStartTime(fmt(task.getStartTime()));
        vo.setEndTime(fmt(task.getEndTime()));
        vo.setErrorMessage(task.getErrorMessage());
        return vo;
    }

    private String fmt(LocalDateTime value) {
        return value == null ? null : value.format(DATETIME_FMT);
    }

    private int nz(Integer value) {
        return value == null ? 0 : value;
    }

    /** timeRange 支持 7d / 30d 这类写法，认不出按 30 天 */
    private int parseDays(String timeRange) {
        if (timeRange == null || timeRange.isEmpty()) {
            return 30;
        }
        String digits = timeRange.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) {
            return 30;
        }
        int days = Integer.parseInt(digits);
        return (days <= 0 || days > 365) ? 30 : days;
    }

    private String cell(String value) {
        return value == null ? "" : "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
