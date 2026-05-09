
package com.agri.iot.mapper;

import com.agri.iot.entity.Report;
import com.agri.iot.vo.ReportVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ReportMapper {

    List<ReportVO> selectReportList(@Param("tenantId") String tenantId);

    ReportVO selectReportById(@Param("id") Long id);

    void insert(Report report);

    void update(Report report);

    void deleteById(@Param("id") Long id);
}
