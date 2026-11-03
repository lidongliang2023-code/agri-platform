package com.agri.masterdata.vo;

import com.agri.masterdata.entity.User;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserVO {

    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    private String userCode;

    private String username;

    private String realName;

    private String nickName;

    private String userType;

    private String idCardType;

    private String idCardNo;

    private String phone;

    private String email;

    private String avatarUrl;

    private String gender;

    private Date birthday;

    private String province;

    private String city;

    private String district;

    private String address;

    private Long orgId;

    private String orgName;

    private String userStatus;

    private String realNameStatus;

    private String riskLevel;

    private Integer creditScore;

    private Date lastLoginTime;

    private String lastLoginIp;

    private Integer loginCount;

    private Integer status;

    private List<Long> roleIds;

    private List<String> roleNames;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String updateBy;

    private LocalDateTime updateTime;

    private String remark;

    /** 统一用户当前绑定的经营主体（来自 platform_user_merchant）。 */
    private List<Membership> memberships;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Membership {
        @JsonSerialize(using = ToStringSerializer.class)
        private Long bindingId;

        @JsonSerialize(using = ToStringSerializer.class)
        private Long subjectId;
        private String subjectName;
        private String memberType;
        private String roleInMerchant;
        private String verifyStatus;
        private Integer status;
    }

    public static UserVO fromEntity(User user) {
        if (user == null) {
            return null;
        }
        return UserVO.builder()
                .id(user.getId())
                .userCode(user.getUserCode())
                .username(user.getUsername())
                .realName(user.getRealName())
                .userType(user.getUserType())
                .idCardType(user.getIdCardType())
                .idCardNo(user.getIdCardNo())
                .phone(user.getPhone())
                .email(user.getEmail())
                .province(user.getProvince())
                .city(user.getCity())
                .district(user.getDistrict())
                .address(user.getAddress())
                .orgId(user.getOrgId())
                .userStatus(user.getUserStatus())
                .realNameStatus(user.getRealNameStatus())
                .status(user.getStatus())
                .tenantId(user.getTenantId())
                .createBy(user.getCreateBy())
                .createTime(user.getCreateTime())
                .updateBy(user.getUpdateBy())
                .updateTime(user.getUpdateTime())
                .build();
    }
}
