package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.UserMemberVO;

import java.util.List;
import java.util.Map;

/**
 * 用户端：团队与人员（{@code /api/v1/production/members}）。
 *
 * <p>与同域其它用户端服务同口径：按 {@code TenantContextService} 解析出的租户过滤。</p>
 */
public interface IUserMemberService {

    /** 成员分页（keyword 匹配姓名/手机号，status、farmId 可选）。 */
    PageResult<UserMemberVO> page(int pageNum, int pageSize, String tenantId, String keyword, Integer status,
                                  String farmId);

    /**
     * 邀请/新增成员。
     *
     * <p>页面发的是"邀请"（status=2 待激活），此时没有 user_id；不传状态时按 1 在职处理 ——
     * 直接新增一个"已激活"的成员，比默默存成待激活更符合页面文案。</p>
     *
     * @return 新成员编号
     * @throws com.agri.production.common.exception.BusinessException 姓名/手机号缺失或格式不对（400）
     */
    String create(String tenantId, MemberPayload payload);

    /**
     * 更新成员（姓名 / 手机号 / 类型 / 岗位 / 角色 / 状态）。
     *
     * @throws com.agri.production.common.exception.BusinessException 参数非法（400）/ 成员不存在（404）
     */
    UserMemberVO update(String tenantId, String memberId, MemberPayload payload);

    /**
     * 移除成员（逻辑删除）。
     *
     * @throws com.agri.production.common.exception.BusinessException 成员不存在（404）
     */
    void delete(String tenantId, String memberId);

    /**
     * 按角色聚合在职人数（页面「角色与权限」用）。
     *
     * <p>只统计 **status = 1 在职** 的成员；待激活（2）与被停用（0）不算"在职人数"。
     * 返回 {@code [{roleCode, memberCount}]}，与页面 {@code fetchRoles} 读的字段一致。</p>
     */
    List<Map<String, Object>> roleHeadcount(String tenantId);

    /**
     * 成员写操作的入参（页面按后端字段名发送：memberName / phone / memberType / postName /
     * roleCode / farmId / userId / joinDate / status）。
     *
     * @param memberName 姓名
     * @param phone      手机号
     * @param memberType 成员类型
     * @param postName   岗位
     * @param roleCode   角色编码
     * @param farmId     所属农场
     * @param userId     平台用户编号（邀请时为空）
     * @param joinDate   加入日期 yyyy-MM-dd
     * @param status     1 在职 / 2 待激活 / 0 已停用
     */
    record MemberPayload(String memberName, String phone, String memberType, String postName, String roleCode,
                         String farmId, String userId, String joinDate, Integer status) {
    }
}
