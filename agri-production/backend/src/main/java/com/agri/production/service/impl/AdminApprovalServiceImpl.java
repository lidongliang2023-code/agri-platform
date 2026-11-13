package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Approval;
import com.agri.production.entity.ApprovalFlow;
import com.agri.production.mapper.ApprovalFlowMapper;
import com.agri.production.mapper.ApprovalMapper;
import com.agri.production.service.IAdminApprovalService;
import com.agri.production.vo.AdminApprovalFlowVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;

/** 历史审批档案。公共认证归平台，业务决策只允许通过所属领域服务。 */
@Service
public class AdminApprovalServiceImpl implements IAdminApprovalService {
    private final ApprovalMapper approvalMapper;
    private final ApprovalFlowMapper approvalFlowMapper;
    public AdminApprovalServiceImpl(ApprovalMapper approvals, ApprovalFlowMapper flows) {
        this.approvalMapper = approvals;
        this.approvalFlowMapper = flows;
    }
    @Override
    public PageResult<Approval> pageApprovals(int pageNum, int pageSize, String keyword, Integer status, String bizType) {
        int p = Math.max(1, pageNum), s = Math.min(200, Math.max(1, pageSize));
        LambdaQueryWrapper<Approval> w = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(Approval::getTitle, kw).or().like(Approval::getApprovalCode, kw).or().like(Approval::getApplicantName, kw));
        }
        if (status != null) w.in(Approval::getStatus, statusTexts(status));
        if (bizType != null && !bizType.isBlank()) w.eq(Approval::getBizType, bizType.trim().toUpperCase());
        w.orderByDesc(Approval::getSubmitAt).orderByDesc(Approval::getId);
        Page<Approval> page = approvalMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }
    @Override
    public PageResult<Approval> pageHistory(int pageNum, int pageSize, String keyword) {
        int p = Math.max(1, pageNum), s = Math.min(200, Math.max(1, pageSize));
        LambdaQueryWrapper<Approval> w = new LambdaQueryWrapper<Approval>()
                .in(Approval::getStatus, List.of("APPROVED", "approved", "REJECTED", "rejected"));
        if (keyword != null && !keyword.isBlank()) w.and(q -> q.like(Approval::getTitle, keyword.trim()).or().like(Approval::getApprovalCode, keyword.trim()));
        w.orderByDesc(Approval::getApproveAt).orderByDesc(Approval::getId);
        Page<Approval> page = approvalMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }
    @Override
    public Approval detail(String approvalId) {
        if (approvalId == null || approvalId.isBlank()) throw new BusinessException(400, "缺少审批编号");
        Approval row = approvalMapper.selectOne(new LambdaQueryWrapper<Approval>()
                .eq(Approval::getApprovalCode, approvalId.trim()).last("LIMIT 1"));
        if (row == null) throw new BusinessException(404, "历史审批单不存在");
        return row;
    }
    private BusinessException retired() {
        return new BusinessException(410, "旧审批管理已停办。身份及主体认证请前往用户中心；计划由主体内部审批；质量处置请使用不合格品处置。旧配额单和流程配置不再执行。");
    }
    @Override public Approval approve(String id, String remark) { throw retired(); }
    @Override public Approval reject(String id, String remark) { throw retired(); }
    @Override public Map<String, Object> batchApprove(List<String> ids, String remark) { throw retired(); }
    @Override public AdminApprovalFlowVO createFlow(Map<String, Object> payload) { throw retired(); }
    @Override public AdminApprovalFlowVO updateFlow(String id, Map<String, Object> payload) { throw retired(); }
    @Override public void deleteFlow(String id) { throw retired(); }
    @Override
    public PageResult<AdminApprovalFlowVO> pageFlows(int pageNum, int pageSize) {
        int p = Math.max(1, pageNum), s = Math.min(200, Math.max(1, pageSize));
        Page<ApprovalFlow> page = approvalFlowMapper.selectPage(new Page<>(p, s), new LambdaQueryWrapper<ApprovalFlow>().orderByAsc(ApprovalFlow::getId));
        return PageResult.of(page.getRecords().stream().map(AdminApprovalFlowVO::of).toList(), page.getTotal(), p, s);
    }
    private static List<String> statusTexts(int code) {
        return switch (code) {
            case 2 -> List.of("APPROVED", "approved");
            case 3 -> List.of("REJECTED", "rejected");
            case 4 -> List.of("WITHDRAWN", "withdrawn");
            default -> List.of("PENDING", "pending");
        };
    }
}
