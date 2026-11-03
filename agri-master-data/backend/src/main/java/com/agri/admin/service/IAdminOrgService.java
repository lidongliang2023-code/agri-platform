package com.agri.admin.service;

import com.agri.admin.vo.OrgAuditVO;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.OrganizationSaveDTO;
import com.agri.masterdata.vo.OrganizationVO;

import java.util.List;

public interface IAdminOrgService {

    PageResult<OrganizationVO> getOrgList(Integer pageNum, Integer pageSize, String keyword, String orgName,
                                          String orgType, String tenantId, Integer status);

    List<OrganizationVO> getOrgTree(String tenantId);

    OrganizationVO getOrgDetail(Long id);

    Long createOrg(OrganizationSaveDTO dto);

    void updateOrg(Long id, OrganizationSaveDTO dto);

    void deleteOrg(Long id);

    void updateOrgStatus(Long id, Integer status);

    PageResult<OrgAuditVO> getOrgCertAuditList(Integer pageNum, Integer pageSize, String authStatus);

    void reviewOrgCert(Long id, String authStatus, String auditNote);
}
