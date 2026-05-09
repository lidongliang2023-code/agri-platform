package com.agri.monitor.service;

import com.agri.monitor.dto.GatewayPageDTO;
import com.agri.monitor.dto.GatewaySaveDTO;
import com.agri.monitor.dto.GatewayVO;
import com.agri.monitor.result.Result;

public interface IGatewayService {
    Result<?> page(GatewayPageDTO dto);
    Result<GatewayVO> detail(Long id);
    Result<Void> save(GatewaySaveDTO dto);
    Result<Void> update(Long id, GatewaySaveDTO dto);
    Result<Void> delete(Long id);
    Result<Void> heartbeat(Long id);
}
