package com.agri.masterdata.dto;

import com.agri.common.vo.PageVO;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class UserPageDTO extends PageVO {

    private String userCode;

    private String username;

    private String realName;

    private String phone;

    private String email;

    private String userType;

    private String realNameStatus;

    private String userStatus;

    private Long orgId;

    private Integer status;
}
