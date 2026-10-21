package com.agri.platform.internal.account;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/** 用户收货地址。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("platform_user_address")
public class UserAddressEntity extends BaseEntity {

    private Long userId;
    private String receiverName;
    private String contactPhone;
    private String province;
    private String city;
    private String district;
    private String detailAddress;
    private String postalCode;
    private Integer isDefault;
}
