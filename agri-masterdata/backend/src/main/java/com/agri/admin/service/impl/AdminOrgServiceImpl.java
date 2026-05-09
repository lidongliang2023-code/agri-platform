package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminOrgService;
import com.agri.admin.vo.OrgAuditVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.Organization;
import com.agri.masterdata.mapper.OrganizationMapper;
import com.agri.masterdata.vo.OrganizationVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminOrgServiceImpl implements IAdminOrgService {

    private final OrganizationMapper organizationMapper;

    @Override
    public PageResult<OrganizationVO> getOrgList(Integer pageNum, Integer pageSize, String orgName, String orgType, String tenantId) {
        int offset = (pageNum - 1) * pageSize;
        List<OrganizationVO> list = organizationMapper.selectAdminOrgList(offset, pageSize, orgName, orgType, tenantId);
        long total = organizationMapper.countAdminOrgList(orgName, orgType, tenantId);
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public List<OrganizationVO> getOrgTree(String tenantId) {
        List<Organization> allOrgs = organizationMapper.selectOrgByTenantId(tenantId);
        return buildOrgTree(null, allOrgs);
    }

    private List<OrganizationVO> buildOrgTree(Long parentId, List<Organization> allOrgs) {
        List<OrganizationVO> tree = new ArrayList<>();
        for (Organization org : allOrgs) {
            if ((parentId == null && org.getParentId() == null) || 
                (parentId != null && parentId.equals(org.getParentId()))) {
                OrganizationVO vo = OrganizationVO.fromEntity(org);
                vo.setChildren(buildOrgTree(org.getId(), allOrgs));
                tree.add(vo);
            }
        }
        return tree;
    }

    @Override
    public OrganizationVO getOrgDetail(Long id) {
        Organization org = organizationMapper.selectById(id);
        if (org == null) {
            throw new BusinessException("组织不存在");
        }
        return OrganizationVO.fromEntity(org);
    }

    @Override
    @Transactional
    public void createOrg(Organization org) {
        organizationMapper.insert(org);
    }

    @Override
    @Transactional
    public void updateOrg(Long id, Organization org) {
        org.setId(id);
        organizationMapper.updateById(org);
    }

    @Override
    @Transactional
    public void deleteOrg(Long id) {
        organizationMapper.deleteById(id);
    }

    @Override
    public PageResult<OrgAuditVO> getOrgCertAuditList(Integer pageNum, Integer pageSize, String authStatus) {
        int offset = (pageNum - 1) * pageSize;
        List<OrgAuditVO> list = organizationMapper.selectOrgCertAuditList(offset, pageSize, authStatus);
        long total = organizationMapper.countOrgCertAuditList(authStatus);
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    @Transactional
    public void reviewOrgCert(Long id, String authStatus, String auditNote) {
        Organization org = organizationMapper.selectById(id);
        if (org == null) {
            throw new BusinessException("组织不存在");
        }
        org.setAuthStatus(authStatus);
        org.setAuditNote(auditNote);
        organizationMapper.updateById(org);
    }
}