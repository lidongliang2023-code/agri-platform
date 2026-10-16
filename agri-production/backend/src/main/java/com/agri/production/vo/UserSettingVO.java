package com.agri.production.vo;

import com.agri.production.entity.SysSetting;
import lombok.Data;

/**
 * 配置项**单条**出参（按 key 查、保存后回读都走它）。
 *
 * <p>字段名就是页面 {@code api/settings.ts} 里 {@code SysSettingSaved} 声明的那四个
 * （settingId / settingKey / settingValue / remark）—— 那层已经按这些名做了映射，
 * 再换名会让 by-key 与 save 两条链路一起读不到值。</p>
 */
@Data
public class UserSettingVO {

    private String settingId;
    private String settingKey;
    private String settingValue;
    private String remark;

    public static UserSettingVO of(SysSetting entity) {
        if (entity == null) {
            return null;
        }
        UserSettingVO vo = new UserSettingVO();
        vo.settingId = entity.getSettingId();
        vo.settingKey = entity.getSettingKey();
        vo.settingValue = entity.getSettingValue();
        vo.remark = entity.getRemark();
        return vo;
    }
}
