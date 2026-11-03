package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 权限巡检规则（{@code agri_md_permission_rule}）。
 *
 * <p>阈值与开关放库里，页面那张"检测规则口径"表才可能照实渲染 —— 以前它是写死在模板里的四行说明文字，
 * 后端没有对应实现，页面还专门注明"不代表当前已生效"。</p>
 *
 * <p>不继承 {@code BaseEntity}：本模块的全局逻辑删除字段是 {@code delFlag}（列 {@code del_flag}），
 * 而基类里另有一个标注了 {@code @TableLogic} 的 {@code deleted}，混用会让查询挂上一个不存在的列。</p>
 */
@Data
@TableName("agri_md_permission_rule")
public class PermissionRule {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 规则编码；扫描结果按它归因，也是去重键的一部分 */
    private String ruleCode;

    private String ruleName;

    /** OVER_PRIVILEGE / MUTEX_ROLE / EXPIRED_GRANT / BINDING_INTEGRITY */
    private String anomalyType;

    /** danger / warning（与页面的 StatusTag 档位一致） */
    private String severity;

    /** 判定口径，一处实现对应一个取值 */
    private String metric;

    /** 阈值；不适用的规则为 null，页面显示"—"而不是编一个数 */
    private Integer threshold;

    private Integer enabled;

    private String remark;

    @TableField("del_flag")
    private Integer delFlag;

    private String tenantId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
