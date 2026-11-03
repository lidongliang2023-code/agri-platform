package com.agri.platform.internal.uc;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 账号侧参数配置（用户中心运营端）。
 *
 * <p>注册 / 实名 / 密码 / 会话 / 验证码五组策略。放在表里而不是 {@code application.yml}，
 * 是因为这些值运营要能自己改、改完要留痕 —— yml 改一次就得发版重启。</p>
 *
 * <p><b>注意</b>：当前实现是"配置可读写 + 变更记审计"，真正的生效点（注册开关、密码强度校验）
 * 仍读各自代码里的常量。要完全接管需逐个把常量替换成读取本表，属独立改造。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_uc_system_config")
public class SystemConfigEntity extends BaseEntity {

    /** register / realname / password / session / captcha */
    private String configGroup;

    private String configKey;
    private String label;
    private String configValue;

    /** text / number / switch / select / multi */
    private String valueType;

    /** 选项，逗号分隔 */
    private String options;

    private String remark;
    private Integer sortNo;
}
