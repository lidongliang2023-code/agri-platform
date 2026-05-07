package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Organization;
import com.agri.masterdata.vo.OrganizationVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface OrganizationMapper extends BaseMapper<Organization> {

    List<OrganizationVO> selectOrgTree(@Param("tenantId") String tenantId);

    List<OrganizationVO> selectOrgChildren(@Param("parentId") Long parentId, @Param("tenantId") String tenantId);
}
