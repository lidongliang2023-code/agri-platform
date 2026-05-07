package com.agri.masterdata.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("agri_md_role_menu")
public class RoleMenu {

    private Long id;

    private Long roleId;

    private Long menuId;
}
