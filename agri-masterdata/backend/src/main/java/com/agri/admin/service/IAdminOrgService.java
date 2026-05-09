package com.agri.admin.service;

import com.agri.admin.vo.OrgAuditVO;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.entity.Organization;
import com.agri.masterdata.vo.OrganizationVO;

import java.util.List;

public interface IAdminOrgService {

    PageResult<OrganizationVO> getOrgList(Integer pageNum, Integer pageSize, String orgName, String orgType, String tenantId);

    List<OrganizationVO> getOrgTree(String tenantId);

    OrganizationVO getOrgDetail(Long id);

    void createOrg(Organization org);

    void updateOrg(Long id, Organization org);

    void deleteOrg(Long id);

    PageResult<OrgAuditVO> getOrgCertAuditList(Integer pageNum, Integer pageSize, String authStatus);

    void reviewOrgCert(Long id, String authStatus, String auditNote);
}