package com.agri.monitor.service;

import com.agri.monitor.dto.PlotPageDTO;
import com.agri.monitor.dto.PlotSaveDTO;
import com.agri.monitor.dto.PlotVO;
import com.agri.monitor.result.Result;
import java.util.List;

public interface IPlotService {
    Result<?> page(PlotPageDTO dto);
    Result<List<PlotVO>> list();
    Result<PlotVO> detail(Long id);
    Result<Void> save(PlotSaveDTO dto);
    Result<Void> update(Long id, PlotSaveDTO dto);
    Result<Void> delete(Long id);
}
