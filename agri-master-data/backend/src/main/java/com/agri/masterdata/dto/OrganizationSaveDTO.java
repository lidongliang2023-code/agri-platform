package com.agri.masterdata.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 主体内组织的新增/编辑入参。
 *
 * <p>主体、父组织、层级和路径的合法性由服务端校验，前端提交值不能直接决定组织树结构。</p>
 */
@Data
public class OrganizationSaveDTO {

    @NotBlank(message = "组织必须归属一个企业或个人主体")
    @Size(max = 64, message = "主体 ID 长度不正确")
    private String tenantId;

    @Size(max = 64, message = "组织编码长度不能超过 64 个字符")
    private String orgCode;

    @NotBlank(message = "组织名称不能为空")
    @Size(max = 128, message = "组织名称长度不能超过 128 个字符")
    private String orgName;

    @Pattern(
            regexp = "DEPARTMENT|TEAM|PRODUCTION_UNIT|FARM",
            message = "组织类型必须是部门、团队、生产单位或农场/基地"
    )
    private String orgType = "DEPARTMENT";

    /** 0 或空表示一级组织。 */
    private Long parentId;

    @Size(max = 64, message = "负责人姓名长度不能超过 64 个字符")
    private String contactPerson;

    @Size(max = 32, message = "联系电话长度不能超过 32 个字符")
    private String contactPhone;

    @Size(max = 64)
    private String province;

    @Size(max = 64)
    private String city;

    @Size(max = 64)
    private String district;

    @Size(max = 500, message = "地址长度不能超过 500 个字符")
    private String address;

    @Min(value = 0, message = "组织状态只能是 0 或 1")
    @Max(value = 1, message = "组织状态只能是 0 或 1")
    private Integer status = 1;

    @Size(max = 500, message = "备注长度不能超过 500 个字符")
    private String remark;
}
