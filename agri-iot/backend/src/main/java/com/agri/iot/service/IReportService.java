
package com.agri.iot.service;

import com.agri.iot.dto.ReportSaveDTO;
import com.agri.iot.vo.ReportVO;

import java.util.List;

public interface IReportService {

    List<ReportVO> list();

    ReportVO getById(Long id);

    void save(ReportSaveDTO dto);

    void update(Long id, ReportSaveDTO dto);

    void delete(Long id);

    void export(Long id);

    Object getData(Long id, String startTime, String endTime);
}
