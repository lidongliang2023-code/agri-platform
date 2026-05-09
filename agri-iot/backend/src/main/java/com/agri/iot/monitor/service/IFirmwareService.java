package com.agri.monitor.service;

import com.agri.monitor.dto.FirmwarePageDTO;
import com.agri.monitor.dto.FirmwareSaveDTO;
import com.agri.monitor.dto.FirmwareVO;
import com.agri.monitor.result.Result;

public interface IFirmwareService {
    Result<?> page(FirmwarePageDTO dto);
    Result<FirmwareVO> detail(Long id);
    Result<Void> save(FirmwareSaveDTO dto);
    Result<Void> update(Long id, FirmwareSaveDTO dto);
    Result<Void> delete(Long id);
    Result<Void> activate(Long id);
}
