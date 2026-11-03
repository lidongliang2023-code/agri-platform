package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.PermissionRequest;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 权限点授权申请。
 *
 * <p>只用 BaseMapper：上一轮 {@code PermissionMapper} / {@code RolePermissionMapper} 就是因为
 * 声明了三个没有 XML 的自定义查询，运行期才抛 "Invalid bound statement (not found)"，
 * 编译期一句提示都没有。这里确实不需要自定义 SQL（去重与状态流转用条件构造器就够了）。</p>
 */
@Mapper
public interface PermissionRequestMapper extends BaseMapper<PermissionRequest> {
}
