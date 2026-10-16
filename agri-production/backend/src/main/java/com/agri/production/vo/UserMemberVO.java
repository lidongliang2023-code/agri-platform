package com.agri.production.vo;

import com.agri.production.entity.TeamMember;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 团队成员出参（页面 {@code Member}）。
 *
 * <p>出参名按页面契约给：{@code member_name→realName}、{@code post_name→position}、
 * {@code join_date→joinedAt}、{@code role_code→roleCode}（页面把它并进 {@code roleIds}）。
 * 页面的 {@code normalizeMember} 同时认两套命名，但只给一套能省掉一次"到底取的哪套"的排查。</p>
 *
 * <p>刻意**不**编造 {@code roleNames}（角色中文名）：角色名是平台域 {@code /api/v1/admin/roles} 的权威数据，
 * 本服务把 role_code 当名字返回等于在页面上显示 "FARM_OWNER" 这种编码 —— 页面按空值渲染 '-' 更诚实。</p>
 */
@Data
public class UserMemberVO {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * 成员台账主键（本服务数字 ID）。

     *
     * <p>为什么要把主键暴露出去：种养计划的「负责人」是 BIGINT 列 {@code manager_id}，
     * 页面下拉必须拿得到这个数字才能选人（{@code memberId} 是 {@code DEMO-MEM-001} 这种业务串，
     * 塞进 BIGINT 列只能落到 name 列、显示成编码）。与地块下拉需要数字 plotId 同理。</p>
     */
    private Long id;

    private String memberId;
    private String userId;
    private String realName;
    private String phone;
    private String farmId;
    /** 岗位 */
    private String position;
    /** OWNER / AGRONOMIST / INSPECTOR / OPERATOR */
    private String memberType;
    /** 角色编码 */
    private String roleCode;
    /** 1 在职 / 2 待激活 / 0 已停用 */
    private Integer status;
    /** 加入日期 yyyy-MM-dd */
    private String joinedAt;

    public static UserMemberVO of(TeamMember entity) {
        if (entity == null) {
            return null;
        }
        UserMemberVO vo = new UserMemberVO();
        vo.id = entity.getId();
        vo.memberId = entity.getMemberId();
        vo.userId = entity.getUserId();
        vo.realName = entity.getMemberName();
        vo.phone = entity.getPhone();
        vo.farmId = entity.getFarmId();
        vo.position = entity.getPostName();
        vo.memberType = entity.getMemberType();
        vo.roleCode = entity.getRoleCode();
        vo.status = entity.getStatus();
        vo.joinedAt = entity.getJoinDate() == null ? null : DATE.format(entity.getJoinDate());
        return vo;
    }
}
