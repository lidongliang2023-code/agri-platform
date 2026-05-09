package com.agri.monitor.service.impl;

import com.agri.monitor.dto.OtaTaskPageDTO;
import com.agri.monitor.dto.OtaTaskSaveDTO;
import com.agri.monitor.dto.OtaTaskVO;
import com.agri.monitor.entity.OtaTask;
import com.agri.monitor.mapper.OtaTaskMapper;
import com.agri.monitor.result.Result;
import com.agri.monitor.service.IOtaTaskService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class OtaTaskServiceImpl extends ServiceImpl<OtaTaskMapper, OtaTask> implements IOtaTaskService {

    @Override
    public Result<?> page(OtaTaskPageDTO dto) {
        Page<OtaTaskVO> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        OtaTaskVO queryVO = new OtaTaskVO();
        queryVO.setTaskCode(dto.getTaskCode());
        queryVO.setTaskName(dto.getTaskName());
        queryVO.setTaskType(dto.getTaskType());
        queryVO.setTaskStatus(dto.getTaskStatus());
        IPage<OtaTaskVO> result = baseMapper.selectPageList(page, queryVO);
        return Result.success(result);
    }

    @Override
    public Result<OtaTaskVO> detail(Long id) {
        OtaTaskVO vo = baseMapper.selectDetailById(id);
        return Result.success(vo);
    }

    @Override
    public Result<Void> save(OtaTaskSaveDTO dto) {
        OtaTask task = new OtaTask();
        BeanUtils.copyProperties(dto, task);
        task.setTaskCode("OTA-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        task.setTaskStatus(0);
        task.setTotalDevices(0);
        task.setSuccessDevices(0);
        task.setFailDevices(0);
        baseMapper.insert(task);
        return Result.success();
    }

    @Override
    public Result<Void> update(Long id, OtaTaskSaveDTO dto) {
        OtaTask task = baseMapper.selectById(id);
        if (task == null) {
            return Result.error(404, "任务不存在");
        }
        if (task.getTaskStatus() != 0) {
            return Result.error(400, "任务已开始执行，无法修改");
        }
        BeanUtils.copyProperties(dto, task);
        task.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(task);
        return Result.success();
    }

    @Override
    public Result<Void> delete(Long id) {
        OtaTask task = baseMapper.selectById(id);
        if (task != null && task.getTaskStatus() == 1) {
            return Result.error(400, "任务正在执行中，无法删除");
        }
        baseMapper.deleteById(id);
        return Result.success();
    }

    @Override
    public Result<Void> execute(Long id) {
        OtaTask task = baseMapper.selectById(id);
        if (task == null) {
            return Result.error(404, "任务不存在");
        }
        if (task.getTaskStatus() == 1) {
            return Result.error(400, "任务已在执行中");
        }
        task.setTaskStatus(1);
        task.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(task);
        return Result.success();
    }

    @Override
    public Result<Void> cancel(Long id) {
        OtaTask task = baseMapper.selectById(id);
        if (task == null) {
            return Result.error(404, "任务不存在");
        }
        if (task.getTaskStatus() == 2) {
            return Result.error(400, "任务已完成，无法取消");
        }
        task.setTaskStatus(3);
        task.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(task);
        return Result.success();
    }
}
