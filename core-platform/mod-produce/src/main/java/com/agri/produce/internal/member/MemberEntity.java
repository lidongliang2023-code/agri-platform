package com.agri.produce.internal.member;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;

/**
 * 生产团队成员（农场主/农技员/巡检员/操作员）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_member")
public class MemberEntity extends ProduceBaseEntity {

    @TableId(value = "member_id", type = IdType.INPUT)
    private String memberId;

    /** 农场ID */
    private String farmId;

    /** 平台用户ID */
    private String userId;

    /** 姓名 */
    private String memberName;

    /** 成员类型 OWNER/AGRONOMIST/INSPECTOR/OPERATOR */
    private String memberType;

    /** 手机号 */
    private String phone;

    /** 角色编码 */
    private String roleCode;

    /** 岗位 */
    private String postName;

    /** 加入日期 */
    private LocalDate joinDate;

    /** 状态 1在职 0离职 */
    private Integer status;
}
