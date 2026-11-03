package com.agri.admin.vo;

import lombok.Data;

/**
 * 单条巡检发现（规则查询的返回行）。
 *
 * <p>每条规则的 SQL 都返回这个形状，扫描器只负责补上规则元数据（类型/等级）与落库，
 * 于是"加一条规则"只需要加一个查询 + 一行规则种子，不用改判定框架。</p>
 */
@Data
public class AnomalyFinding {

    /** USER / ROLE_MENU / USER_ROLE / ROLE_MENU_DUP */
    private String targetType;

    /** 对象主键（字符串，避免前端精度丢失）；重复绑定这类"组合对象"用 a-b 形式 */
    private String targetId;

    private String targetName;

    private String tenantId;

    /** 判定依据（含具体数字与对象名） */
    private String detail;
}
