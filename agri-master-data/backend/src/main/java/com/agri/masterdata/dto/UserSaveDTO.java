package com.agri.masterdata.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Date;

@Data
public class UserSaveDTO {

    @NotBlank(message = "用户名不能为空")
    @Size(max = 50, message = "用户名长度不能超过50")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 100, message = "密码长度必须在6-100之间")
    private String password;

    @Size(max = 100, message = "真实姓名长度不能超过100")
    private String realName;

    @Size(max = 100, message = "昵称长度不能超过100")
    private String nickName;

    @NotBlank(message = "用户类型不能为空")
    @Size(max = 20, message = "用户类型长度不能超过20")
    private String userType;

    @Size(max = 20, message = "证件类型长度不能超过20")
    private String idCardType;

    @Size(max = 50, message = "证件号码长度不能超过50")
    private String idCardNo;

    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Email(message = "邮箱格式不正确")
    @Size(max = 100, message = "邮箱长度不能超过100")
    private String email;

    @Size(max = 500, message = "头像URL长度不能超过500")
    private String avatarUrl;

    @Size(max = 10, message = "性别长度不能超过10")
    private String gender;

    private Date birthday;

    @Size(max = 50, message = "省份长度不能超过50")
    private String province;

    @Size(max = 50, message = "城市长度不能超过50")
    private String city;

    @Size(max = 50, message = "区县长度不能超过50")
    private String district;

    @Size(max = 255, message = "详细地址长度不能超过255")
    private String address;

    private Long orgId;

    @Size(max = 20, message = "用户状态长度不能超过20")
    private String userStatus;

    @Size(max = 20, message = "实名状态长度不能超过20")
    private String realNameStatus;

    private Integer status;

    private String remark;
}
