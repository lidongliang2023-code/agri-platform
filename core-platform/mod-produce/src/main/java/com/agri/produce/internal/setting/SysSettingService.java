package com.agri.produce.internal.setting;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 系统配置项（租户/农场级参数） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class SysSettingService {

    private static final String ID_PREFIX = "SETG";

    private final SysSettingMapper sysSettingMapper;

    /**
     * 分页查询。
     *
     * @param keyword settingName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<SysSettingEntity> page(long page, long size, String keyword, Integer status) {
        Page<SysSettingEntity> result = sysSettingMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<SysSettingEntity>()
                        .like(keyword != null && !keyword.isBlank(), SysSettingEntity::getSettingName, keyword)
                        .eq(status != null, SysSettingEntity::getStatus, status)
                        .orderByDesc(SysSettingEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public SysSettingEntity detail(String id) {
        SysSettingEntity entity = sysSettingMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public SysSettingEntity create(SysSettingEntity entity) {
        if (entity.getSettingId() == null || entity.getSettingId().isBlank()) {
            entity.setSettingId(ProduceIds.newId(ID_PREFIX));
        }
        sysSettingMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public SysSettingEntity update(String id, SysSettingEntity entity) {
        entity.setSettingId(id);
        sysSettingMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        sysSettingMapper.deleteById(id);
    }

    /** 按配置键读取 */
    public SysSettingEntity getByKey(String settingKey) {
        List<SysSettingEntity> list = sysSettingMapper.selectList(new LambdaQueryWrapper<SysSettingEntity>()
                .eq(SysSettingEntity::getSettingKey, settingKey)
                .last("LIMIT 1"));
        return list.isEmpty() ? null : list.get(0);
    }

    /** 保存（存在则更新，不存在则新增） */
    @Transactional
    public SysSettingEntity saveSetting(SysSettingEntity setting) {
        SysSettingEntity exists = getByKey(setting.getSettingKey());
        if (exists == null) {
            if (setting.getSettingId() == null || setting.getSettingId().isBlank()) {
                setting.setSettingId(ProduceIds.newId("SETG"));
            }
            sysSettingMapper.insert(setting);
            return setting;
        }
        exists.setSettingValue(setting.getSettingValue());
        exists.setSettingName(setting.getSettingName());
        sysSettingMapper.updateById(exists);
        return exists;
    }
}
