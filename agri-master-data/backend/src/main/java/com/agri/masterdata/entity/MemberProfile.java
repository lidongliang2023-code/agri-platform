package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 成员任职档案：统一认证账号在本主体内的组织位置。
 *
 * <p><b>为什么不继承 {@code BaseEntity}</b>：那个基类带 {@code create_by} / {@code update_by} /
 * {@code remark} / {@code tenantId(Long)}，而本表没有这几列，且 {@code tenant_id} 是
 * VARCHAR（主体编码形如 {@code 2001} / {@code T1001}）。继承过来会直接
 * {@code Unknown column}。这里显式声明全部字段。</p>
 *
 * <p><b>为什么不复用 {@code agri_md_user}</b>：那张表 {@code password} 是 NOT NULL、
 * {@code username} 是全局唯一，而同一个账号可以在多个主体任职。给 SSO 账号在本地建档案
 * 就得填假密码，还会因为 username 冲突插不进去。账号信息（用户名/手机号/状态）
 * 仍以用户中心为权威源，本表只存"这个账号在这里担任什么职务"。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("agri_md_member_profile")
public class MemberProfile {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属经营主体（与请求头 X-Agri-Merchant 一致，服务端强制写入） */
    private String tenantId;

    /** 统一认证账号 ID（platform_user.id），不是本地 agri_md_user.id */
    private Long platformUserId;

    /** 所属组织（agri_md_organization.id，雪花 Long 的字符串形式） */
    private String orgId;

    /**
     * 所属部门（agri_md_department.id，自增 BIGINT 的字符串形式）。
     *
     * <p>⚠️ 不是 {@code dept_id} 那个 varchar 业务码 —— 部门表有两套 id：
     * {@code id}（自增，真正主键）与 {@code dept_id}（雪花业务码，实体 {@code @TableId}）。
     * 岗位表的 {@code dept_id} 指向的是前者，这里保持一致。</p>
     */
    private String deptId;

    /** 岗位（agri_md_position.position_id，雪花业务主键，本身就是 varchar） */
    private String positionId;

    /** 在职状态：active / left */
    private String jobStatus;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
