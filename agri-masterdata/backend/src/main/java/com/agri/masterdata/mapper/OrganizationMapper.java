package com.agri.masterdata.mapper;

import com.agri.admin.vo.OrgAuditVO;
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

    List<Organization> selectOrgByTenantId(@Param("tenantId") String tenantId);

    List<OrganizationVO> selectAdminOrgList(@Param("offset") Integer offset, @Param("limit") Integer limit, 
                                            @Param("orgName") String orgName, @Param("orgType") String orgType, 
                                            @Param("tenantId") String tenantId);

    long countAdminOrgList(@Param("orgName") String orgName, @Param("orgType") String orgType, @Param("tenantId") String tenantId);

    List<OrgAuditVO> selectOrgCertAuditList(@Param("offset") Integer offset, @Param("limit") Integer limit, @Param("authStatus") String authStatus);

    long countOrgCertAuditList(@Param("authStatus") String authStatus);
}
