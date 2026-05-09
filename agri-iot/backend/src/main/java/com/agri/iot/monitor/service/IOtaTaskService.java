package com.agri.monitor.service;

import com.agri.monitor.dto.OtaTaskPageDTO;
import com.agri.monitor.dto.OtaTaskSaveDTO;
import com.agri.monitor.dto.OtaTaskVO;
import com.agri.monitor.result.Result;

public interface IOtaTaskService {
    Result<?> page(OtaTaskPageDTO dto);
    Result<OtaTaskVO> detail(Long id);
    Result<Void> save(OtaTaskSaveDTO dto);
    Result<Void> update(Long id, OtaTaskSaveDTO dto);
    Result<Void> delete(Long id);
    Result<Void> execute(Long id);
    Result<Void> cancel(Long id);
}
