package com.agri.iot.mapper;

import com.agri.iot.dto.request.GatewayQueryDTO;
import com.agri.iot.entity.Gateway;
import com.agri.iot.vo.GatewayVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface GatewayMapper extends BaseMapper<Gateway> {

    List<GatewayVO> selectPageVO(@Param("dto") GatewayQueryDTO dto);

    long selectCount(@Param("dto") GatewayQueryDTO dto);

    GatewayVO selectVOById(Long id);

    Gateway selectByGatewayCode(String gatewayCode);

    List<GatewayVO> selectAllVO();
}