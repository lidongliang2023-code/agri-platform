package com.agri.platform.api.facade;

import com.agri.platform.api.dto.UserDTO;

/**
 * 用户中心 OHS 门面：其他模块仅允许经本接口消费用户主数据，禁止私建用户表（ADR-004）。
 */
public interface UserFacade {

    UserDTO findById(Long userId);

    boolean existsActive(Long userId);
}
