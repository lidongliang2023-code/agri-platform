package com.agri.admin.service;

import com.agri.admin.vo.SystemConfigVO;

import java.util.List;
import java.util.Map;

public interface IAdminSystemConfigService {

    List<SystemConfigVO> getSystemConfigList(String configType);

    SystemConfigVO getSystemConfigDetail(Long id);

    void createSystemConfig(SystemConfigVO config);

    void updateSystemConfig(Long id, SystemConfigVO config);

    void deleteSystemConfig(Long id);

    String getConfigValue(String configKey);

    void batchUpdateConfig(Map<String, String> configMap);
}