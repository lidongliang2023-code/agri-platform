package com.agri.admin.service.impl;

import com.agri.admin.client.CoreTenantSubjectClient;
import com.agri.admin.service.IAdminOrgService;
import com.agri.admin.vo.OrgAuditVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.util.SnowflakeIdUtil;
import com.agri.masterdata.dto.OrganizationSaveDTO;
import com.agri.masterdata.entity.Organization;
import com.agri.masterdata.mapper.OrganizationMapper;
import com.agri.masterdata.vo.OrganizationVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class AdminOrgServiceImpl implements IAdminOrgService {

    private static final Set<String> ORG_TYPES =
            Set.of("DEPARTMENT", "TEAM", "PRODUCTION_UNIT", "FARM");
    private static final Map<String, String> ORG_TYPE_NAMES = Map.of(
            "DEPARTMENT", "部门",
            "TEAM", "团队",
            "PRODUCTION_UNIT", "生产单位",
            "FARM", "农场/基地"
    );

    private final OrganizationMapper organizationMapper;
    private final CoreTenantSubjectClient coreTenantSubjectClient;

    @Override
    public PageResult<OrganizationVO> getOrgList(Integer pageNum, Integer pageSize, String keyword,
                                                 String orgName, String orgType, String tenantId,
                                                 Integer status) {
        int safePageNum = pageNum == null || pageNum < 1 ? 1 : pageNum;
        int safePageSize = pageSize == null || pageSize < 1 ? 10 : Math.min(pageSize, 200);
        int offset = (safePageNum - 1) * safePageSize;
        List<OrganizationVO> list = organizationMapper.selectAdminOrgList(
                offset, safePageSize, blankToNull(keyword), blankToNull(orgName),
                blankToNull(orgType), blankToNull(tenantId), status);
        long total = organizationMapper.countAdminOrgList(
                blankToNull(keyword), blankToNull(orgName),
                blankToNull(orgType), blankToNull(tenantId), status);
        enrichOrgList(list, new HashMap<>());
        return PageResult.success(list, total, safePageNum, safePageSize);
    }

    @Override
    public List<OrganizationVO> getOrgTree(String tenantId) {
        List<Organization> allOrgs = organizationMapper.selectOrgByTenantId(blankToNull(tenantId));
        List<OrganizationVO> roots = buildOrgTree(null, allOrgs);
        enrichTree(roots, new HashMap<>());
        return roots;
    }

    private boolean isRoot(Long parentId) {
        return parentId == null || parentId == 0L;
    }

    private List<OrganizationVO> buildOrgTree(Long parentId, List<Organization> allOrgs) {
        List<OrganizationVO> tree = new ArrayList<>();
        for (Organization org : allOrgs) {
            boolean matched = parentId == null
                    ? isRoot(org.getParentId())
                    : parentId.equals(org.getParentId());
            if (matched) {
                OrganizationVO vo = OrganizationVO.fromEntity(org);
                List<OrganizationVO> children = buildOrgTree(org.getId(), allOrgs);
                vo.setChildren(children);
                vo.setChildCount(children.size());
                tree.add(vo);
            }
        }
        return tree;
    }

    @Override
    public OrganizationVO getOrgDetail(Long id) {
        OrganizationVO org = organizationMapper.selectAdminOrgDetail(id);
        if (org == null) {
            throw new BusinessException("组织不存在或已删除");
        }
        enrichOrg(org, new HashMap<>());
        List<OrganizationVO> children =
                organizationMapper.selectOrgChildren(id, org.getTenantId());
        enrichOrgList(children, new HashMap<>());
        org.setChildren(children);
        org.setChildCount(children.size());
        return org;
    }

    @Override
    @Transactional
    public Long createOrg(OrganizationSaveDTO dto) {
        requireSubject(dto.getTenantId());
        String tenantId = dto.getTenantId().trim();
        String orgCode = normalizeOrgCode(dto.getOrgCode());
        ensureOrgCodeUnique(orgCode, null);
        String orgType = normalizeOrgType(dto.getOrgType());
        Organization parent = resolveParent(tenantId, dto.getParentId());

        Organization org = new Organization();
        org.setTenantId(tenantId);
        org.setOrgCode(orgCode);
        org.setOrgName(dto.getOrgName().trim());
        org.setOrgType(orgType);
        org.setContactPerson(trimToNull(dto.getContactPerson()));
        org.setContactPhone(trimToNull(dto.getContactPhone()));
        org.setContactMobile(trimToNull(dto.getContactPhone()));
        org.setProvince(trimToNull(dto.getProvince()));
        org.setCity(trimToNull(dto.getCity()));
        org.setDistrict(trimToNull(dto.getDistrict()));
        org.setAddress(trimToNull(dto.getAddress()));
        org.setStatus(normalizeStatus(dto.getStatus()));
        org.setOrgStatus(org.getStatus() == 1 ? "ACTIVE" : "INACTIVE");
        org.setRemark(trimToNull(dto.getRemark()));
        applyHierarchy(org, parent);
        organizationMapper.insert(org);
        return org.getId();
    }

    @Override
    @Transactional
    public void updateOrg(Long id, OrganizationSaveDTO dto) {
        Organization existing = requireEditableOrg(id);
        if (!existing.getTenantId().equals(dto.getTenantId())) {
            throw new BusinessException("组织创建后不能跨主体移动");
        }

        String orgCode = normalizeOrgCode(
                dto.getOrgCode() == null || dto.getOrgCode().isBlank()
                        ? existing.getOrgCode() : dto.getOrgCode());
        ensureOrgCodeUnique(orgCode, id);
        Organization parent = resolveParent(existing.getTenantId(), dto.getParentId());
        assertNoCycle(existing, parent);

        existing.setOrgCode(orgCode);
        existing.setOrgName(dto.getOrgName().trim());
        existing.setOrgType(normalizeOrgType(dto.getOrgType()));
        existing.setContactPerson(trimToNull(dto.getContactPerson()));
        existing.setContactPhone(trimToNull(dto.getContactPhone()));
        existing.setContactMobile(trimToNull(dto.getContactPhone()));
        existing.setProvince(trimToNull(dto.getProvince()));
        existing.setCity(trimToNull(dto.getCity()));
        existing.setDistrict(trimToNull(dto.getDistrict()));
        existing.setAddress(trimToNull(dto.getAddress()));
        existing.setStatus(normalizeStatus(dto.getStatus()));
        existing.setOrgStatus(existing.getStatus() == 1 ? "ACTIVE" : "INACTIVE");
        existing.setRemark(trimToNull(dto.getRemark()));
        applyHierarchy(existing, parent);
        organizationMapper.updateById(existing);
        recalculateDescendants(existing);
    }

    @Override
    @Transactional
    public void updateOrgStatus(Long id, Integer status) {
        Organization existing = requireEditableOrg(id);
        int normalizedStatus = normalizeStatus(status);
        existing.setStatus(normalizedStatus);
        existing.setOrgStatus(normalizedStatus == 1 ? "ACTIVE" : "INACTIVE");
        organizationMapper.updateById(existing);
    }

    @Override
    @Transactional
    public void deleteOrg(Long id) {
        Organization existing = requireEditableOrg(id);
        long children = organizationMapper.selectCount(
                new LambdaQueryWrapper<Organization>()
                        .eq(Organization::getParentId, id)
                        .eq(Organization::getDelFlag, 0));
        if (children > 0) {
            throw new BusinessException("该组织下仍有子组织，请先调整或删除子组织");
        }
        organizationMapper.deleteById(existing.getId());
    }

    @Override
    public PageResult<OrgAuditVO> getOrgCertAuditList(Integer pageNum, Integer pageSize, String authStatus) {
        int offset = (pageNum - 1) * pageSize;
        List<OrgAuditVO> list = organizationMapper.selectOrgCertAuditList(offset, pageSize, authStatus);
        long total = organizationMapper.countOrgCertAuditList(authStatus);
        return PageResult.success(list, total, pageNum, pageSize);
    }

    /**
     * 历史兼容接口。组织不再是认证对象，企业/个人认证统一由经营主体认证流程处理。
     */
    @Override
    @Transactional
    public void reviewOrgCert(Long id, String authStatus, String auditNote) {
        Organization org = organizationMapper.selectById(id);
        if (org == null || Integer.valueOf(1).equals(org.getDelFlag())) {
            throw new BusinessException("组织不存在或已删除");
        }
        org.setAuthStatus(authStatus);
        org.setAuditNote(auditNote);
        organizationMapper.updateById(org);
    }

    private Organization requireEditableOrg(Long id) {
        Organization org = organizationMapper.selectById(id);
        if (org == null || Integer.valueOf(1).equals(org.getDelFlag())) {
            throw new BusinessException("组织不存在或已删除");
        }
        requireSubject(org.getTenantId());
        return org;
    }

    private CoreTenantSubjectClient.CoreTenantSubject requireSubject(String tenantId) {
        CoreTenantSubjectClient.CoreTenantSubject subject = loadSubject(tenantId);
        if (subject == null) {
            throw new BusinessException("所选企业或个人主体不存在，或不是统一经营主体");
        }
        if (!Integer.valueOf(1).equals(subject.status())) {
            throw new BusinessException("所选主体已停用，不能新增或调整组织");
        }
        return subject;
    }

    private CoreTenantSubjectClient.CoreTenantSubject loadSubject(String tenantId) {
        String normalized = trimToNull(tenantId);
        if (normalized == null || !normalized.matches("\\d+")) {
            return null;
        }
        try {
            CoreTenantSubjectClient.CoreApiResponse<CoreTenantSubjectClient.CoreTenantSubject> response =
                    coreTenantSubjectClient.detail(Long.parseLong(normalized));
            if (response.code() != null && response.code() == 0 && response.data() != null) {
                return response.data();
            }
            if (response.message() != null && !response.message().isBlank()) {
                log.debug("经营主体 {} 查询失败：{}", normalized, response.message());
            }
        } catch (RuntimeException ex) {
            log.debug("经营主体 {} 查询异常：{}", normalized, ex.getMessage());
        }
        return null;
    }

    private Organization resolveParent(String tenantId, Long parentId) {
        if (parentId == null || parentId == 0L) {
            return null;
        }
        Organization parent = organizationMapper.selectById(parentId);
        if (parent == null || Integer.valueOf(1).equals(parent.getDelFlag())) {
            throw new BusinessException("上级组织不存在或已删除");
        }
        if (!tenantId.equals(parent.getTenantId())) {
            throw new BusinessException("上级组织必须与当前组织属于同一主体");
        }
        return parent;
    }

    private void assertNoCycle(Organization existing, Organization parent) {
        if (parent == null) {
            return;
        }
        if (existing.getId().equals(parent.getId())) {
            throw new BusinessException("组织不能选择自己作为上级");
        }
        if (parent.getAncestors() != null
                && List.of(parent.getAncestors().split(",")).contains(existing.getId().toString())) {
            throw new BusinessException("上级组织不能是当前组织的下级，否则会形成循环层级");
        }
    }

    private void applyHierarchy(Organization org, Organization parent) {
        if (parent == null) {
            org.setParentId(0L);
            org.setOrgLevel(1);
            org.setAncestors("0");
            org.setOrgPath("/" + org.getOrgCode());
            return;
        }
        org.setParentId(parent.getId());
        org.setOrgLevel(parent.getOrgLevel() == null ? 2 : parent.getOrgLevel() + 1);
        String parentAncestors = parent.getAncestors() == null || parent.getAncestors().isBlank()
                ? "0" : parent.getAncestors();
        org.setAncestors(parentAncestors + "," + parent.getId());
        String parentPath = parent.getOrgPath() == null || parent.getOrgPath().isBlank()
                ? "/" + parent.getOrgCode() : parent.getOrgPath();
        org.setOrgPath(parentPath + "/" + org.getOrgCode());
    }

    private void recalculateDescendants(Organization root) {
        List<Organization> allOrgs = organizationMapper.selectOrgByTenantId(root.getTenantId());
        Map<Long, List<Organization>> childrenByParent = new HashMap<>();
        for (Organization org : allOrgs) {
            Long parentId = org.getParentId() == null ? 0L : org.getParentId();
            childrenByParent.computeIfAbsent(parentId, key -> new ArrayList<>()).add(org);
        }
        rewriteChildren(root, childrenByParent, new HashSet<>());
    }

    private void rewriteChildren(Organization parent,
                                 Map<Long, List<Organization>> childrenByParent,
                                 Set<Long> visited) {
        if (!visited.add(parent.getId())) {
            return;
        }
        for (Organization child : childrenByParent.getOrDefault(parent.getId(), List.of())) {
            child.setOrgLevel(parent.getOrgLevel() == null ? 2 : parent.getOrgLevel() + 1);
            child.setAncestors(parent.getAncestors() + "," + parent.getId());
            child.setOrgPath(parent.getOrgPath() + "/" + child.getOrgCode());
            organizationMapper.updateById(child);
            rewriteChildren(child, childrenByParent, visited);
        }
    }

    private String normalizeOrgCode(String input) {
        String code = trimToNull(input);
        if (code == null) {
            code = "ORG" + SnowflakeIdUtil.nextIdStr();
        }
        code = code.toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9_-]{2,64}")) {
            throw new BusinessException("组织编码只能包含字母、数字、下划线或中划线，长度 2-64 位");
        }
        return code;
    }

    private String normalizeOrgType(String input) {
        String type = trimToNull(input);
        type = type == null ? "DEPARTMENT" : type.toUpperCase(Locale.ROOT);
        if (!ORG_TYPES.contains(type)) {
            throw new BusinessException("组织类型必须是部门、团队、生产单位或农场/基地");
        }
        return type;
    }

    private int normalizeStatus(Integer status) {
        if (status == null) {
            return 1;
        }
        if (status != 0 && status != 1) {
            throw new BusinessException("组织状态只能是启用或停用");
        }
        return status;
    }

    private void ensureOrgCodeUnique(String orgCode, Long excludeId) {
        LambdaQueryWrapper<Organization> wrapper = new LambdaQueryWrapper<Organization>()
                .eq(Organization::getOrgCode, orgCode)
                .eq(Organization::getDelFlag, 0);
        if (excludeId != null) {
            wrapper.ne(Organization::getId, excludeId);
        }
        if (organizationMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("组织编码已存在，请更换后重试");
        }
    }

    private void enrichTree(List<OrganizationVO> nodes,
                            Map<String, Optional<CoreTenantSubjectClient.CoreTenantSubject>> subjectCache) {
        for (OrganizationVO node : nodes) {
            enrichOrg(node, subjectCache);
            if (node.getChildren() != null && !node.getChildren().isEmpty()) {
                enrichTree(node.getChildren(), subjectCache);
                node.setChildCount(node.getChildren().size());
            }
        }
    }

    private void enrichOrgList(List<OrganizationVO> list,
                               Map<String, Optional<CoreTenantSubjectClient.CoreTenantSubject>> subjectCache) {
        if (list == null) {
            return;
        }
        for (OrganizationVO org : list) {
            enrichOrg(org, subjectCache);
        }
    }

    private void enrichOrg(OrganizationVO org,
                           Map<String, Optional<CoreTenantSubjectClient.CoreTenantSubject>> subjectCache) {
        org.setOrgTypeName(ORG_TYPE_NAMES.getOrDefault(org.getOrgType(), org.getOrgType()));
        String tenantId = org.getTenantId();
        Optional<CoreTenantSubjectClient.CoreTenantSubject> subject = subjectCache.computeIfAbsent(
                tenantId == null ? "" : tenantId,
                key -> Optional.ofNullable(loadSubject(key))
        );
        boolean linked = subject.isPresent();
        org.setSubjectLinked(linked);
        org.setLegacy(!linked);
        org.setEditable(linked);
        if (linked) {
            org.setTenantName(subject.get().tenantName());
        } else if (org.getTenantName() == null || org.getTenantName().isBlank()) {
            org.setTenantName("历史主体 " + (tenantId == null ? "未知" : tenantId));
        }
        if (org.getContactPhone() == null || org.getContactPhone().isBlank()) {
            org.setContactPhone(org.getContactMobile());
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String result = value.trim();
        return result.isEmpty() ? null : result;
    }

    private static String blankToNull(String value) {
        return trimToNull(value);
    }
}
