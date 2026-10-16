package com.agri.production.service;

import com.agri.production.vo.UserSettingItemVO;
import com.agri.production.vo.UserSettingVO;

import java.util.List;

/**
 * 用户端：系统设置·参数配置（{@code /api/v1/production/settings}）。
 *
 * <p>只覆盖配置项本身（列表 / 按 key 查 / 保存）。两个刻意不做的：
 * {@code /settings/tenant}（租户档案属平台域主数据，见网关与 probe 的说明）与
 * {@code /settings/logs}（本部署没有操作日志表，页面已按"未接入"显式提示，不去造一份假日志）。</p>
 */
public interface IUserSettingService {

    /** 配置项列表（按分组、键排序，返回**裸数组**——页面声明的是数组，不是分页结构）。 */
    List<UserSettingItemVO> list(String tenantId);

    /** 按配置键查一条；不存在返回 null（页面按 null 处理，不当作错误）。 */
    UserSettingVO byKey(String tenantId, String settingKey);

    /**
     * 保存配置（**按 key upsert**：有则更新值/说明，无则新增）。
     *
     * @return 保存后的配置项
     * @throws com.agri.production.common.exception.BusinessException 键为空或超长（400）
     */
    UserSettingVO save(String tenantId, String settingKey, String settingValue, String remark);
}
