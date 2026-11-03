package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 角色互斥对（{@code agri_md_role_mutex}）：职责分离的规则来源。
 *
 * <p>用角色<b>编码</b>而不是主键：编码是稳定标识，主键在不同环境的种子里会变；
 * 互斥关系一旦按主键存，换库就悄悄失效，而页面看不出来。</p>
 */
@Data
@TableName("agri_md_role_mutex")
public class RoleMutex {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private String roleCodeA;

    private String roleCodeB;

    /** 为什么互斥；异常描述里会带上它，审计要能看懂结论 */
    private String reason;

    private Integer enabled;

    @TableField("del_flag")
    private Integer delFlag;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
