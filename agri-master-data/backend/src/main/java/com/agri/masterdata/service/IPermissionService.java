package com.agri.masterdata.service;

import com.agri.masterdata.vo.PermissionVO;

import java.util.List;
import java.util.Set;

/**
 * 权限点目录与授权（按钮级 / API 级）。
 *
 * <p>与 {@code IAdminPermissionService} 的分工：那边管"角色 + 菜单级授权 + 审计"，
 * 这边只管权限点这一张目录与 {@code agri_md_role_permission} 这张授权表。</p>
 */
public interface IPermissionService {

    /** 目录列表（矩阵页与权限点页共用）；keyword 命中编码、名称或路径。 */
    List<PermissionVO> listPoints(String keyword, String module);

    /** 某角色已持有的权限点 id（字符串，避免前端精度截断）。 */
    List<String> pointIdsOfRole(Long roleId);

    /** 某角色已持有的权限点明细。 */
    List<PermissionVO> pointsOfRole(Long roleId);

    /**
     * 覆盖式保存某角色的权限点授权。
     *
     * @return 生效的授权条数
     */
    int assignRolePoints(Long roleId, List<String> permIds, String operator);

    /** 撤销某角色的全部权限点授权。 */
    int clearRolePoints(Long roleId);

    /**
     * 当前已纳管（被任意角色持有）的全部权限点编码。
     *
     * <p>"已纳管"这条事实只有这一个入口（判定见 {@code PermissionPointGuard.deniedFor}）：
     * 逐条问会退化成 N 次查询，而两处各写一遍就是口径漂移的开始。</p>
     */
    java.util.Set<String> restrictedCodes();

    /** 某本地用户通过其角色持有的权限点编码集合。 */
    Set<String> grantedCodesOfUser(Long userId);

    /**
     * 平台用户名 → 本地账号主键（桥接规则只在这一处）。
     *
     * <p>运营端令牌的主键来自 core-platform，主体侧令牌来自本模块，两套 id 不同源；
     * 但用户名是同一个人，本模块早就按"成员以用户中心为权威源"处理这件事。
     * 账号存在但一个角色都没绑，视为没有本地身份（返回 null），与"没这个账号"同义。</p>
     */
    Long localUserIdByUsername(String username);

    /** 按用户名取当前生效的权限点编码（鉴权拦截器与"我的权限点"接口都走它，保证口径一致）。 */
    Set<String> grantedCodesByUsername(String username);

    /** 按编码取权限点（鉴权拦截器用）。 */
    PermissionVO pointByCode(String permCode);

    /**
     * 把某个权限点授给该用户名桥到的<b>每一个本地角色</b>（授权申请通过时走这里）。
     *
     * <p>授权只存在于"角色 ↔ 权限点"这一层，账号本身没有授权位；所以"给他授权"只能落成
     * "给他已有的角色都补上这个点"。一个角色都没绑时明确失败 —— 静默成功会让人以为已经放开了。</p>
     *
     * @return 实际新增的授权条数（0 表示他已有的角色都持有了）
     */
    int grantCodeToUserRoles(String username, String permCode, String operator);
}
