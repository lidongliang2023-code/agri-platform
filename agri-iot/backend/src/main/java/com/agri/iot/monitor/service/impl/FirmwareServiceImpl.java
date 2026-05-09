package com.agri.monitor.service.impl;

import com.agri.monitor.dto.FirmwarePageDTO;
import com.agri.monitor.dto.FirmwareSaveDTO;
import com.agri.monitor.dto.FirmwareVO;
import com.agri.monitor.entity.Firmware;
import com.agri.monitor.mapper.FirmwareMapper;
import com.agri.monitor.result.Result;
import com.agri.monitor.service.IFirmwareService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
public class FirmwareServiceImpl extends ServiceImpl<FirmwareMapper, Firmware> implements IFirmwareService {

    @Override
    public Result<?> page(FirmwarePageDTO dto) {
        Page<FirmwareVO> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        FirmwareVO queryVO = new FirmwareVO();
        queryVO.setFirmwareCode(dto.getFirmwareCode());
        queryVO.setFirmwareName(dto.getFirmwareName());
        queryVO.setDeviceType(dto.getDeviceType());
        queryVO.setIsActive(dto.getIsActive());
        IPage<FirmwareVO> result = baseMapper.selectPageList(page, queryVO);
        return Result.success(result);
    }

    @Override
    public Result<FirmwareVO> detail(Long id) {
        FirmwareVO vo = baseMapper.selectDetailById(id);
        return Result.success(vo);
    }

    @Override
    public Result<Void> save(FirmwareSaveDTO dto) {
        Firmware firmware = new Firmware();
        BeanUtils.copyProperties(dto, firmware);
        firmware.setDownloadCount(0);
        if (firmware.getIsActive() == null) {
            firmware.setIsActive(0);
        }
        baseMapper.insert(firmware);
        return Result.success();
    }

    @Override
    public Result<Void> update(Long id, FirmwareSaveDTO dto) {
        Firmware firmware = baseMapper.selectById(id);
        if (firmware == null) {
            return Result.error(404, "固件不存在");
        }
        BeanUtils.copyProperties(dto, firmware);
        firmware.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(firmware);
        return Result.success();
    }

    @Override
    public Result<Void> delete(Long id) {
        baseMapper.deleteById(id);
        return Result.success();
    }

    @Override
    public Result<Void> activate(Long id) {
        Firmware firmware = baseMapper.selectById(id);
        if (firmware == null) {
            return Result.error(404, "固件不存在");
        }
        firmware.setIsActive(1);
        firmware.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(firmware);
        return Result.success();
    }
}
