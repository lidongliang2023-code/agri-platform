package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.Permission;
import com.agri.masterdata.entity.PermissionRequest;
import com.agri.masterdata.mapper.PermissionMapper;
import com.agri.masterdata.mapper.PermissionRequestMapper;
import com.agri.masterdata.service.IPermissionRequestService;
import com.agri.masterdata.service.IPermissionService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 权限点授权申请。
 *
 * <p>三条刻意的设计，都是为了"这条链真的能走完"：</p>
 * <ul>
 *   <li><b>提交即查重</b>：同一申请人对同一个点只留一条 PENDING，重复提交返回那条已有的 ——
 *       表上没有唯一键（全局逻辑删除 + 唯一键会让"驳回后重新申请"必然 Duplicate entry，
 *       这个坑在 {@code agri_md_role_permission} 上踩过），所以查重只能在这里做；</li>
 *   <li><b>同意就真授权</b>：调 {@link IPermissionService#grantCodeToUserRoles} 写
 *       {@code agri_md_role_permission}，与鉴权拦截器读的是同一张表，不存在"同意了但还没放开"；</li>
 *   <li><b>驳回必须写原因</b>：不写原因的驳回让申请人只能再提一遍，等于把队列变成噪音。</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class PermissionRequestServiceImpl implements IPermissionRequestService {

    /** 列表上限：申请单是人工处理的队列，超过这个量说明已经没人看了，宁可显式截断也不静默 */
    private static final int MAX_LIST = 200;

    private final PermissionRequestMapper requestMapper;
    private final PermissionMapper permissionMapper;
    private final IPermissionService permissionService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public PermissionRequest submit(String applicant, String applicantName, String permCode,
                                    String reason, String pagePath, String tenantId) {
        if (isBlank(applicant)) {
            throw new BusinessException(400, "缺少申请人身份，无法提交授权申请");
        }
        if (isBlank(permCode)) {
            throw new BusinessException(400, "缺少权限点编码，无法提交授权申请");
        }
        // 只受理目录里真实在册的点：给一个不存在的编码排队，处理时必然失败
        Permission point = permissionMapper.selectOne(new LambdaQueryWrapper<Permission>()
                .eq(Permission::getPermCode, permCode.trim()).last("LIMIT 1"));
        if (point == null) {
            throw new BusinessException(400, "权限点不存在或已下线：" + permCode);
        }
        PermissionRequest pending = requestMapper.selectOne(new LambdaQueryWrapper<PermissionRequest>()
                .eq(PermissionRequest::getApplicant, applicant.trim())
                .eq(PermissionRequest::getPermCode, permCode.trim())
                .eq(PermissionRequest::getStatus, PermissionRequest.PENDING)
                .orderByDesc(PermissionRequest::getId).last("LIMIT 1"));
        if (pending != null) {
            return pending;
        }
        LocalDateTime now = LocalDateTime.now();
        PermissionRequest request = new PermissionRequest();
        request.setApplicant(applicant.trim());
        request.setApplicantName(applicantName);
        request.setPermCode(permCode.trim());
        // 名称快照：点以后可能下线，申请单要一直读得懂当时申请的是什么
        request.setPermName(point.getPermName());
        request.setPagePath(pagePath);
        request.setReason(isBlank(reason) ? null : reason.trim());
        request.setStatus(PermissionRequest.PENDING);
        request.setDelFlag(0);
        request.setTenantId(tenantId);
        request.setCreateTime(now);
        request.setUpdateTime(now);
        requestMapper.insert(request);
        return request;
    }

    @Override
    public List<PermissionRequest> list(String status, String keyword) {
        LambdaQueryWrapper<PermissionRequest> wrapper = new LambdaQueryWrapper<PermissionRequest>()
                .orderByDesc(PermissionRequest::getId)
                .last("LIMIT " + MAX_LIST);
        if (!isBlank(status)) {
            wrapper.eq(PermissionRequest::getStatus, status.trim().toUpperCase());
        }
        if (!isBlank(keyword)) {
            String kw = keyword.trim();
            wrapper.and(q -> q.like(PermissionRequest::getApplicant, kw)
                    .or().like(PermissionRequest::getPermCode, kw)
                    .or().like(PermissionRequest::getPermName, kw));
        }
        return requestMapper.selectList(wrapper);
    }

    @Override
    public List<String> pendingCodesOf(String applicant) {
        if (isBlank(applicant)) {
            return List.of();
        }
        return requestMapper.selectList(new LambdaQueryWrapper<PermissionRequest>()
                        .eq(PermissionRequest::getApplicant, applicant.trim())
                        .eq(PermissionRequest::getStatus, PermissionRequest.PENDING))
                .stream().map(PermissionRequest::getPermCode).distinct().toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> handle(Long id, boolean approve, String remark, String handler) {
        PermissionRequest request = requestMapper.selectById(id);
        if (request == null) {
            throw new BusinessException(404, "申请单不存在：" + id);
        }
        if (!PermissionRequest.PENDING.equals(request.getStatus())) {
            throw new BusinessException(400,
                    "这条申请已经处理过了（当前状态 " + request.getStatus() + "），不重复处理");
        }
        if (isBlank(handler)) {
            throw new BusinessException(401, "取不到处理人身份，拒绝写入处理结果");
        }
        LocalDateTime now = LocalDateTime.now();
        Map<String, Object> result = new HashMap<>();
        int granted = 0;
        if (approve) {
            granted = permissionService.grantCodeToUserRoles(request.getApplicant(), request.getPermCode(), handler);
            request.setStatus(PermissionRequest.APPROVED);
            request.setHandleRemark(isBlank(remark)
                    ? "已把该点授给申请人的 " + (granted > 0 ? granted : 0) + " 个角色"
                    + (granted == 0 ? "（他原有的角色已经持有这个点）" : "")
                    : remark.trim());
        } else {
            if (isBlank(remark)) {
                throw new BusinessException(400, "驳回必须写原因：不写原因的驳回只会让申请人再提一遍");
            }
            request.setStatus(PermissionRequest.REJECTED);
            request.setHandleRemark(remark.trim());
        }
        request.setHandler(handler);
        request.setHandleTime(now);
        request.setUpdateTime(now);
        requestMapper.updateById(request);
        result.put("id", String.valueOf(request.getId()));
        result.put("status", request.getStatus());
        result.put("granted", granted);
        result.put("message", request.getHandleRemark());
        return result;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
