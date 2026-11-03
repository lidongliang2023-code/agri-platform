package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 权限点授权申请（{@code agri_md_permission_request}）。
 *
 * <p>存在的理由只有一条：横幅上那颗「申请授权」按钮要能走完一条链 ——
 * 提交 → 运营端矩阵页看到 → 同意即真的写授权。只落一行"有人申请了"而没有任何地方能处理，
 * 就是又一处"有能力却说未接入"。</p>
 *
 * <p>{@code applicant} 存<b>平台账号用户名</b>而不是主键：权限点本来就是按
 * "平台用户名 → 本地账号"桥接的（{@code PermissionServiceImpl.localUserIdByUsername}），
 * 运营端令牌的主键来自 core-platform、主体侧令牌来自本模块，两套 id 不同源，
 * 存主键等于再造一套身份口径。</p>
 *
 * <p>{@code permName} 是提交时的快照：权限点可能后续下线（{@code del_flag=1}），
 * 但申请单要一直读得懂当时申请的是什么。</p>
 */
@Data
@TableName("agri_md_permission_request")
public class PermissionRequest {

    /** 待处理 */
    public static final String PENDING = "PENDING";
    /** 已同意（授权已写入 agri_md_role_permission） */
    public static final String APPROVED = "APPROVED";
    /** 已驳回 */
    public static final String REJECTED = "REJECTED";

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("applicant")
    private String applicant;

    @TableField("applicant_name")
    private String applicantName;

    @TableField("perm_code")
    private String permCode;

    @TableField("perm_name")
    private String permName;

    /** 从哪个页面提的（路由），处理人能对上具体是哪个按钮 */
    @TableField("page_path")
    private String pagePath;

    private String reason;

    /** PENDING / APPROVED / REJECTED */
    private String status;

    /** 处理人：取自令牌的平台账号，不写死"admin" */
    private String handler;

    @TableField("handle_remark")
    private String handleRemark;

    @TableField("handle_time")
    private LocalDateTime handleTime;

    private Integer delFlag;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;
}
