package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminSystemConfigService;
import com.agri.admin.vo.SystemConfigVO;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.SystemConfig;
import com.agri.masterdata.mapper.SystemConfigMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 系统配置管理。
 *
 * <p>本类原来是**七个空壳**：列表恒返回空数组、`getConfigValue` 恒返回写死的 `"test.value"`、
 * 详情报的是 `test.key / 测试配置`、增删改全是空方法体。表现出来是"页面上一个参数都没有，
 * 但接口全都 200"。现在全部落地到 `agri_md_system_config`。</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AdminSystemConfigServiceImpl implements IAdminSystemConfigService {

    private final SystemConfigMapper systemConfigMapper;

    @Override
    public List<SystemConfigVO> getSystemConfigList(String configType) {
        LambdaQueryWrapper<SystemConfig> wrapper = new LambdaQueryWrapper<>();
        if (configType != null && !configType.isEmpty()) {
            wrapper.eq(SystemConfig::getConfigType, configType);
        }
        // 按分组 + 组内排序返回：参数配置页是"按分组看"的场景，乱序返回等于每次刷新都要重排
        wrapper.orderByAsc(SystemConfig::getGroupName).orderByAsc(SystemConfig::getSortOrder);

        List<SystemConfigVO> list = new ArrayList<>();
        for (SystemConfig config : systemConfigMapper.selectList(wrapper)) {
            list.add(toVO(config));
        }
        return list;
    }

    @Override
    public SystemConfigVO getSystemConfigDetail(Long id) {
        SystemConfig config = systemConfigMapper.selectById(id);
        if (config == null) {
            throw new BusinessException("配置项不存在");
        }
        return toVO(config);
    }

    @Override
    @Transactional
    public void createSystemConfig(SystemConfigVO config) {
        if (config.getConfigKey() == null || config.getConfigKey().isEmpty()) {
            throw new BusinessException("参数编码不能为空");
        }
        Long exists = systemConfigMapper.selectCount(
                new LambdaQueryWrapper<SystemConfig>().eq(SystemConfig::getConfigKey, config.getConfigKey()));
        if (exists != null && exists > 0) {
            throw new BusinessException("参数编码已存在：" + config.getConfigKey());
        }

        SystemConfig entity = new SystemConfig();
        entity.setConfigKey(config.getConfigKey());
        applyVo(entity, config);
        entity.setStatus(config.getStatus() == null ? 1 : config.getStatus());
        entity.setDelFlag(0);
        systemConfigMapper.insert(entity);
    }

    @Override
    @Transactional
    public void updateSystemConfig(Long id, SystemConfigVO config) {
        SystemConfig entity = systemConfigMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("配置项不存在");
        }
        // 只覆盖本次传了的字段：启用/禁用开关只带一个 status，
        // 若在这里无脑 set 全部字段，参数名称、值、分组会被一并清空。
        applyVo(entity, config);
        if (config.getStatus() != null) {
            entity.setStatus(config.getStatus());
        }
        systemConfigMapper.updateById(entity);
    }

    @Override
    @Transactional
    public void deleteSystemConfig(Long id) {
        SystemConfig entity = systemConfigMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("配置项不存在");
        }
        // 走 del_flag 逻辑删除（MyBatis-Plus 已配 logic-delete-field=delFlag）
        systemConfigMapper.deleteById(id);
    }

    @Override
    public String getConfigValue(String configKey) {
        SystemConfig config = systemConfigMapper.selectOne(
                new LambdaQueryWrapper<SystemConfig>().eq(SystemConfig::getConfigKey, configKey));
        if (config == null) {
            // 原来这里恒返回 "test.value"：调用方拿到一个看似正常的字符串，
            // 完全不知道这个 key 根本不存在 —— 这类"永远有值"的兜底最危险，直接抛错。
            throw new BusinessException("配置项不存在：" + configKey);
        }
        return config.getConfigValue();
    }

    @Override
    @Transactional
    public void batchUpdateConfig(Map<String, String> configMap) {
        if (configMap == null || configMap.isEmpty()) {
            return;
        }
        // 先整批校验再整批写入：只改一半就抛错会让配置处于半新半旧的状态，
        // 而且批量的调用方通常以为它是原子的。
        Map<String, SystemConfig> found = new LinkedHashMap<>();
        List<String> unknown = new ArrayList<>();
        for (String key : configMap.keySet()) {
            SystemConfig config = systemConfigMapper.selectOne(
                    new LambdaQueryWrapper<SystemConfig>().eq(SystemConfig::getConfigKey, key));
            if (config == null) {
                unknown.add(key);
            } else {
                found.put(key, config);
            }
        }
        if (!unknown.isEmpty()) {
            // 不静默跳过拼错的 key：那样调用方会以为"全部更新成功"
            throw new BusinessException("以下参数编码不存在：" + String.join("、", unknown));
        }
        for (Map.Entry<String, String> entry : configMap.entrySet()) {
            SystemConfig config = found.get(entry.getKey());
            config.setConfigValue(entry.getValue());
            systemConfigMapper.updateById(config);
        }
    }

    /** VO → 实体（只覆盖非空字段，新增与更新共用） */
    private void applyVo(SystemConfig entity, SystemConfigVO vo) {
        if (vo.getConfigName() != null) {
            entity.setConfigName(vo.getConfigName());
        }
        if (vo.getConfigValue() != null) {
            entity.setConfigValue(vo.getConfigValue());
        }
        if (vo.getConfigType() != null) {
            entity.setConfigType(vo.getConfigType());
        }
        if (vo.getGroupName() != null) {
            entity.setGroupName(vo.getGroupName());
        }
        if (vo.getSortOrder() != null) {
            entity.setSortOrder(vo.getSortOrder());
        }
        if (vo.getDescription() != null) {
            entity.setDescription(vo.getDescription());
        }
    }

    private SystemConfigVO toVO(SystemConfig config) {
        return SystemConfigVO.builder()
                .id(config.getId())
                .configKey(config.getConfigKey())
                .configName(config.getConfigName())
                .configValue(config.getConfigValue())
                .configType(config.getConfigType())
                .groupName(config.getGroupName())
                .sortOrder(config.getSortOrder())
                .description(config.getDescription())
                .status(config.getStatus())
                .createTime(config.getCreateTime() == null ? null : config.getCreateTime().toString())
                .updateTime(config.getUpdateTime() == null ? null : config.getUpdateTime().toString())
                .build();
    }
}
