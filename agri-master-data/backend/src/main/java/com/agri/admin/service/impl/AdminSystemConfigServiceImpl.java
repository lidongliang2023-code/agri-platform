package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminSystemConfigService;
import com.agri.admin.vo.SystemConfigVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminSystemConfigServiceImpl implements IAdminSystemConfigService {

    @Override
    public List<SystemConfigVO> getSystemConfigList(String configType) {
        return new ArrayList<>();
    }

    @Override
    public SystemConfigVO getSystemConfigDetail(Long id) {
        return SystemConfigVO.builder()
                .id(id)
                .configKey("test.key")
                .configValue("test.value")
                .configType("SYSTEM")
                .description("测试配置")
                .build();
    }

    @Override
    @Transactional
    public void createSystemConfig(SystemConfigVO config) {
    }

    @Override
    @Transactional
    public void updateSystemConfig(Long id, SystemConfigVO config) {
    }

    @Override
    @Transactional
    public void deleteSystemConfig(Long id) {
    }

    @Override
    public String getConfigValue(String configKey) {
        return "test.value";
    }

    @Override
    @Transactional
    public void batchUpdateConfig(Map<String, String> configMap) {
    }
}