package com.agri.masterdata.service;

import com.agri.masterdata.entity.PermissionRequest;

import java.util.List;
import java.util.Map;

/**
 * 权限点授权申请（横幅上那颗「申请授权」按钮的后端）。
 *
 * <p>与 {@link IPermissionService} 的分工：那边管目录与授权关系，这边只管申请单这一张表，
 * 以及"同意申请"时调它把点真正落到角色上。</p>
 */
public interface IPermissionRequestService {

    /**
     * 提交一条申请。
     *
     * @return 落库后的申请单（含 id 与状态）
     */
    PermissionRequest submit(String applicant, String applicantName, String permCode,
                             String reason, String pagePath, String tenantId);

    /** 列表；status 为空表示全部，keyword 命中申请人 / 权限点编码 / 名称。 */
    List<PermissionRequest> list(String status, String keyword);

    /** 某申请人当前待处理的权限点编码（用于告诉他"这条已经在排队了"）。 */
    List<String> pendingCodesOf(String applicant);

    /**
     * 处理一条申请。
     *
     * <p>同意 = 把这个点授给申请人已有的每一个本地角色，写的是 {@code agri_md_role_permission}，
     * 与拦截器读的是同一张表 —— 所以处理完他刷新页面就能看见按钮回来。</p>
     *
     * @return {@code {status, granted, message}}；granted 是实际新增的授权条数
     */
    Map<String, Object> handle(Long id, boolean approve, String remark, String handler);
}
