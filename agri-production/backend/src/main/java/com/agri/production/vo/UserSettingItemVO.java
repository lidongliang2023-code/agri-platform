package com.agri.production.vo;

import com.agri.production.entity.SysSetting;
import lombok.Data;

/**
 * 配置项**列表**出参，字段名就是页面的 {@code SettingItem}（configKey / configValue / description）。
 *
 * <p>为什么列表要单独一套名、而不是复用下面那个 {@code SysSettingVO}：页面
 * {@code api/settings.ts#listSettings} 声明的是 {@code Promise<SettingItem[]>} 且**不做任何映射**，
 * 而平台侧的 {@code GET /settings} 返回的是实体字段（settingKey/settingValue/remark）——
 * 于是"配置键 / 配置值"两列一直是空的（实测平台侧返回 records 里就是这三个名）。
 * 这一层转换放在后端，页面就能直接渲染。</p>
 */
@Data
public class UserSettingItemVO {

    /** 配置键 */
    private String configKey;
    /** 配置值 */
    private String configValue;
    /** 说明 */
    private String description;
    /** 分组（页面没用到，留着便于排查"这条配置属于哪一块"） */
    private String configGroup;

    public static UserSettingItemVO of(SysSetting entity) {
        if (entity == null) {
            return null;
        }
        UserSettingItemVO vo = new UserSettingItemVO();
        vo.configKey = entity.getSettingKey();
        vo.configValue = entity.getSettingValue();
        vo.description = entity.getRemark();
        vo.configGroup = entity.getSettingGroup();
        return vo;
    }
}
