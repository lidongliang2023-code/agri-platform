package com.agri.masterdata.vo;

import lombok.Data;

/**
 * 权限点视图（按钮级 / API 级）。
 *
 * <p>{@code id} 一律转成字符串给前端：这些主键会与 {@code agri_md_role_permission.perm_id}
 * 来回传，一旦前端做 {@code Number()} 就会把 18 位雪花精度截掉（本模块已经栽过两次）。</p>
 */
@Data
public class PermissionVO {

    private String id;

    /** 「METHOD 路径」，与鉴权拦截器算出来的编码同一个口径 */
    private String permCode;

    private String permName;

    /** API / BUTTON / PAGE */
    private String permType;

    private String apiPath;

    private String httpMethod;

    /** 所属功能模块（控制器 @Tag），矩阵页按它分组 */
    private String module;

    private Integer status;

    private String remark;

    /** 该点是否已被任何角色持有（= 已纳管，收紧判定读它） */
    private Boolean granted;

    /** 持有该点的角色数，0 表示这个点还没被纳管 */
    private Integer roleCount;
}
