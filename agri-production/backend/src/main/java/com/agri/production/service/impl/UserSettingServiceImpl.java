package com.agri.production.service.impl;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.SysSetting;
import com.agri.production.mapper.SysSettingMapper;
import com.agri.production.service.IUserSettingService;
import com.agri.production.vo.UserSettingItemVO;
import com.agri.production.vo.UserSettingVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 用户端系统设置实现。
 *
 * <p>保存语义与平台侧 {@code saveSetting} 一致：**按 key upsert**。区别只有一处 ——
 * 本服务的 {@code setting_key} 上有唯一索引，所以"同一个 key 两行"这种脏数据从结构上不可能出现。</p>
 */
@Slf4j
@Service
public class UserSettingServiceImpl implements IUserSettingService {

    private static final int KEY_MAX_LENGTH = 64;
    private static final int VALUE_MAX_LENGTH = 500;
    private static final int REMARK_MAX_LENGTH = 200;
    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");

    private final SysSettingMapper settingMapper;

    public UserSettingServiceImpl(SysSettingMapper settingMapper) {
        this.settingMapper = settingMapper;
    }

    @Override
    public List<UserSettingItemVO> list(String tenantId) {
        List<SysSetting> rows = settingMapper.selectList(baseWrapper(tenantId)
                .orderByAsc(SysSetting::getSettingGroup)
                .orderByAsc(SysSetting::getSettingKey));
        return rows.stream().map(UserSettingItemVO::of).toList();
    }

    @Override
    public UserSettingVO byKey(String tenantId, String settingKey) {
        if (settingKey == null || settingKey.isBlank()) {
            throw new BusinessException(400, "配置键为必填");
        }
        return UserSettingVO.of(findByKey(tenantId, settingKey.trim()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserSettingVO save(String tenantId, String settingKey, String settingValue, String remark) {
        String key = requireText(settingKey, "配置键", KEY_MAX_LENGTH);
        String value = optionalText(settingValue, "配置值", VALUE_MAX_LENGTH);
        String note = optionalText(remark, "说明", REMARK_MAX_LENGTH);

        SysSetting existing = findByKey(tenantId, key);
        if (existing == null) {
            SysSetting created = new SysSetting();
            created.setSettingId("SET" + LocalDateTime.now().format(ID_FORMAT));
            created.setTenantId(tenantId);
            created.setSettingKey(key);
            created.setSettingName(key);
            created.setSettingValue(value);
            created.setRemark(note);
            created.setStatus(1);
            settingMapper.insert(created);
            log.info("系统配置新增：{} = {}", key, value);
            return UserSettingVO.of(settingMapper.selectById(created.getId()));
        }
        // 说明传空时不覆盖已有的：页面"只改值"的保存不该把说明抹掉
        if (value != null) {
            existing.setSettingValue(value);
        }
        if (note != null) {
            existing.setRemark(note);
        }
        existing.setUpdateTime(LocalDateTime.now());
        settingMapper.updateById(existing);
        log.info("系统配置更新：{} = {}", key, existing.getSettingValue());
        return UserSettingVO.of(settingMapper.selectById(existing.getId()));
    }

    /* ==================== 内部工具 ==================== */

    private LambdaQueryWrapper<SysSetting> baseWrapper(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法读写系统配置");
        }
        return new LambdaQueryWrapper<SysSetting>().eq(SysSetting::getTenantId, tenantId);
    }

    private SysSetting findByKey(String tenantId, String settingKey) {
        return settingMapper.selectOne(baseWrapper(tenantId)
                .eq(SysSetting::getSettingKey, settingKey)
                .last("LIMIT 1"));
    }

    private String requireText(String value, String field, int maxLength) {
        String trimmed = optionalText(value, field, maxLength);
        if (trimmed == null) {
            throw new BusinessException(400, field + "为必填");
        }
        return trimmed;
    }

    private String optionalText(String value, String field, int maxLength) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > maxLength) {
            throw new BusinessException(400, field + "不得超过 " + maxLength + " 字");
        }
        return trimmed;
    }
}
