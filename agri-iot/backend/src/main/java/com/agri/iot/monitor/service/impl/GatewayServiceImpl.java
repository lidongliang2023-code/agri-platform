package com.agri.monitor.service.impl;

import com.agri.monitor.dto.GatewayPageDTO;
import com.agri.monitor.dto.GatewaySaveDTO;
import com.agri.monitor.dto.GatewayVO;
import com.agri.monitor.entity.Gateway;
import com.agri.monitor.mapper.GatewayMapper;
import com.agri.monitor.result.Result;
import com.agri.monitor.service.IGatewayService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
public class GatewayServiceImpl extends ServiceImpl<GatewayMapper, Gateway> implements IGatewayService {

    @Override
    public Result<?> page(GatewayPageDTO dto) {
        Page<GatewayVO> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        GatewayVO queryVO = new GatewayVO();
        queryVO.setGatewayCode(dto.getGatewayCode());
        queryVO.setGatewayName(dto.getGatewayName());
        queryVO.setPlotId(dto.getPlotId());
        queryVO.setOnlineStatus(dto.getOnlineStatus());
        IPage<GatewayVO> result = baseMapper.selectPageList(page, queryVO);
        return Result.success(result);
    }

    @Override
    public Result<GatewayVO> detail(Long id) {
        GatewayVO vo = baseMapper.selectDetailById(id);
        return Result.success(vo);
    }

    @Override
    public Result<Void> save(GatewaySaveDTO dto) {
        Gateway gateway = new Gateway();
        BeanUtils.copyProperties(dto, gateway);
        gateway.setOnlineStatus(0);
        baseMapper.insert(gateway);
        return Result.success();
    }

    @Override
    public Result<Void> update(Long id, GatewaySaveDTO dto) {
        Gateway gateway = baseMapper.selectById(id);
        if (gateway == null) {
            return Result.error("网关不存在");
        }
        BeanUtils.copyProperties(dto, gateway);
        gateway.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(gateway);
        return Result.success();
    }

    @Override
    public Result<Void> delete(Long id) {
        baseMapper.deleteById(id);
        return Result.success();
    }

    @Override
    public Result<Void> heartbeat(Long id) {
        Gateway gateway = baseMapper.selectById(id);
        if (gateway == null) {
            return Result.error("网关不存在");
        }
        gateway.setOnlineStatus(1);
        gateway.setUpdateTime(LocalDateTime.now());
        baseMapper.updateById(gateway);
        return Result.success();
    }
}
