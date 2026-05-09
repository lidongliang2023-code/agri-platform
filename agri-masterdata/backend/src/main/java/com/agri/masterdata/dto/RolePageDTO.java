package com.agri.masterdata.dto;

import com.agri.common.vo.PageVO;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class RolePageDTO extends PageVO {

    private String roleName;

    private String roleKey;

    private Integer status;
}
