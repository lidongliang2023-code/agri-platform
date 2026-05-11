package com.agri.production.service;

import com.agri.production.dto.TraceCodeGenerateDTO;
import com.agri.production.dto.TraceCodeQueryDTO;
import com.agri.production.entity.TraceCode;
import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.TraceCodeVO;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface ITraceCodeService extends IService<TraceCode> {

    List<TraceCodeVO> generate(TraceCodeGenerateDTO dto, String tenantId);

    TraceCodeVO activate(String traceCode, String tenantId);

    void deactivate(String traceCode, String tenantId);

    TraceCodeVO queryForConsumer(String traceCode);

    TraceCodeVO getByTraceCode(String traceCode, String tenantId);

    PageResult<TraceCodeVO> pageQuery(TraceCodeQueryDTO dto, String tenantId);

    List<TraceCodeVO> listByHarvestId(Long harvestId, String tenantId);
}