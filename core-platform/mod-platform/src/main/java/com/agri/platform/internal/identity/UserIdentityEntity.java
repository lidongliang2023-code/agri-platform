package com.agri.platform.internal.identity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 个人实名认证（一次提交一条；当前状态取最新一条）。
 *
 * <p><b>这里没有也不该有身份证号明文字段</b>：只存掩码、加盐哈希与盐。
 * 实体层就断掉明文，后续任何代码想读明文都读不到。</p>
 */
@Data
@TableName("platform_user_identity")
public class UserIdentityEntity {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long userId;
    private Long marketId;
    private String identityNo;
    private String realName;
    private String idNoMasked;
    private String idNoHash;
    private String idNoSalt;
    /** pending / verified / rejected */
    private String status;
    private LocalDateTime submitTime;
    private Long reviewerId;
    private String reviewerName;
    private LocalDateTime reviewTime;
    private String reviewRemark;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
