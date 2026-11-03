package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.RolePermission;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 角色 ↔ 权限点授权。
 *
 * <p>同 {@code PermissionMapper}：以前声明了 {@code selectByRoleId / deleteByRoleId} 却没有 XML，
 * 一调就抛 "Invalid bound statement"。现在只剩下面这条注解 SQL。</p>
 */
@Mapper
public interface RolePermissionMapper extends BaseMapper<RolePermission> {

    /**
     * 清空某角色的授权 —— 必须是<b>物理删</b>。
     *
     * <p>表上有 {@code uk_role_perm (role_id, perm_id)}；BaseMapper 的 delete 走全局逻辑删除，
     * 只把 del_flag 置 1，行还在唯一键里占位。结果是"取消勾选后再也勾不回来"：第二次授权直接
     * Duplicate entry，页面表现为保存失败。授权关系不保留历史行，回收就是真的回收。</p>
     */
    @Delete("DELETE FROM agri_md_role_permission WHERE role_id = #{roleId}")
    int physicalDeleteByRole(@Param("roleId") Long roleId);
}
