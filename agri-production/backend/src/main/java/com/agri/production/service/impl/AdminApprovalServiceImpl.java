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
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端审批管理实现。
 *
 * <p>表由 schema-patch-approvals.sql 建：审批单此前只在平台侧，而**流程配置平台侧根本没有表**
 * （core 返回三个硬编码骨架，页面却是带完整 CRUD 的）。</p>
 */
@Slf4j
@Service
public class AdminApprovalServiceImpl implements IAdminApprovalService {

    private static final String DEFAULT_TENANT = "2001";
    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_APPROVED = "APPROVED";
    private static final String STATUS_REJECTED = "REJECTED";

    private final ApprovalMapper approvalMapper;
    private final ApprovalFlowMapper approvalFlowMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AdminApprovalServiceImpl(ApprovalMapper approvalMapper, ApprovalFlowMapper approvalFlowMapper) {
        this.approvalMapper = approvalMapper;
        this.approvalFlowMapper = approvalFlowMapper;
    }

    @Override
    public PageResult<Approval> pageApprovals(int pageNum, int pageSize, String keyword, Integer status,
                                             String bizType) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<Approval> w = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(Approval::getTitle, kw).or().like(Approval::getApprovalCode, kw)
                    .or().like(Approval::getApplicantName, kw));
        }
        if (status != null) {
            w.in(Approval::getStatus, statusTexts(status));
        }
        if (bizType != null && !bizType.isBlank()) {
            w.eq(Approval::getBizType, bizType.trim().toUpperCase());
        }
        w.orderByAsc(Approval::getStatus).orderByDesc(Approval::getSubmitAt).orderByDesc(Approval::getId);
        Page<Approval> page = approvalMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }

    @Override
    public PageResult<Approval> pageHistory(int pageNum, int pageSize, String keyword) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<Approval> w = new LambdaQueryWrapper<Approval>()
                .in(Approval::getStatus, List.of(STATUS_APPROVED, "approved", STATUS_REJECTED, "rejected"));
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(Approval::getTitle, kw).or().like(Approval::getApprovalCode, kw)
                    .or().like(Approval::getApplicantName, kw));
        }
        w.orderByDesc(Approval::getApproveAt).orderByDesc(Approval::getId);
        Page<Approval> page = approvalMapper.selectPage(new Page<>(p, s), w);
        return PageResult.of(page.getRecords(), page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Approval approve(String approvalId, String remark) {
        Approval approval = requireApproval(approvalId);
        if (STATUS_APPROVED.equalsIgnoreCase(approval.getStatus())) {
            throw new BusinessException(400, "该审批单已通过，无需重复审批：" + approvalId);
        }
        if (STATUS_REJECTED.equalsIgnoreCase(approval.getStatus())) {
            throw new BusinessException(400, "该审批单已驳回，如需变更请重新提交：" + approvalId);
        }
        approval.setStatus(STATUS_APPROVED);
        approval.setApproveAt(LocalDateTime.now());
        if (remark != null && !remark.isBlank()) {
            approval.setApproveOpinion(remark.trim());
        }
        approval.setUpdateTime(LocalDateTime.now());
        approvalMapper.updateById(approval);
        log.info("审批通过：{} {}", approval.getApprovalCode(), approval.getTitle());
        return approvalMapper.selectById(approval.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> batchApprove(List<String> approvalIds, String remark) {
        if (approvalIds == null || approvalIds.isEmpty()) {
            throw new BusinessException(400, "请选择要审批的单据");
        }
        List<String> approved = new ArrayList<>();
        List<Map<String, Object>> skipped = new ArrayList<>();
        for (String id : approvalIds) {
            try {
                Approval result = approve(id, remark);
                approved.add(result.getApprovalCode());
            } catch (BusinessException e) {
                // 逐条处理：一条失败不该把其余的全回滚 —— 但要**如实回报哪些被跳过、为什么**
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("approvalId", id);
                row.put("reason", e.getMessage());
                skipped.add(row);
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("approvedCount", approved.size());
        result.put("approvedIds", approved);
        result.put("skipped", skipped);
        return result;
    }

    @Override
    public PageResult<AdminApprovalFlowVO> pageFlows(int pageNum, int pageSize) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<ApprovalFlow> w = new LambdaQueryWrapper<ApprovalFlow>()
                .orderByAsc(ApprovalFlow::getId);
        Page<ApprovalFlow> page = approvalFlowMapper.selectPage(new Page<>(p, s), w);
        List<AdminApprovalFlowVO> rows = page.getRecords().stream().map(AdminApprovalFlowVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminApprovalFlowVO createFlow(Map<String, Object> payload) {
        ApprovalFlow flow = new ApprovalFlow();
        flow.setFlowCode("FLOW" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")));
        applyFlowPayload(flow, payload);
        if (flow.getFlowName() == null || flow.getFlowName().isBlank()) {
            throw new BusinessException(400, "流程名称不能为空");
        }
        flow.setStatus(flow.getStatus() == null ? 1 : flow.getStatus());
        flow.setTenantId(DEFAULT_TENANT);
        flow.setCreateTime(LocalDateTime.now());
        flow.setUpdateTime(LocalDateTime.now());
        flow.setDeleted(0);
        approvalFlowMapper.insert(flow);
        log.info("新建审批流程：{} {}", flow.getFlowCode(), flow.getFlowName());
        return AdminApprovalFlowVO.of(approvalFlowMapper.selectById(flow.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminApprovalFlowVO updateFlow(String flowId, Map<String, Object> payload) {
        if (flowId == null || flowId.isBlank()) {
            throw new BusinessException(400, "缺少 flowId");
        }
        ApprovalFlow flow = approvalFlowMapper.selectOne(new LambdaQueryWrapper<ApprovalFlow>()
                .eq(ApprovalFlow::getFlowCode, flowId.trim()).last("LIMIT 1"));
        if (flow == null) {
            throw new BusinessException(404, "审批流程不存在：" + flowId);
        }
        applyFlowPayload(flow, payload);
        flow.setUpdateTime(LocalDateTime.now());
        approvalFlowMapper.updateById(flow);
        return AdminApprovalFlowVO.of(approvalFlowMapper.selectById(flow.getId()));
    }

    private void applyFlowPayload(ApprovalFlow flow, Map<String, Object> payload) {
        if (payload == null) {
            return;
        }
        if (payload.containsKey("flowName")) {
            flow.setFlowName(str(payload.get("flowName")));
        }
        if (payload.containsKey("approvalType")) {
            flow.setApprovalType(str(payload.get("approvalType")));
        }
        if (payload.containsKey("status")) {
            Integer status = toInt(payload.get("status"));
            if (status != null) {
                flow.setStatus(status == 0 ? 0 : 1);
            }
        }
        if (payload.containsKey("nodes")) {
            try {
                flow.setNodesJson(objectMapper.writeValueAsString(payload.get("nodes")));
            } catch (Exception e) {
                // 节点序列化不了属于入参问题，直接拒掉，别存一段坏 JSON 让页面以后打不开
                throw new BusinessException(400, "流程节点格式不正确，无法保存");
            }
        }
    }

    private Approval requireApproval(String approvalId) {
        if (approvalId == null || approvalId.isBlank()) {
            throw new BusinessException(400, "缺少 approvalId");
        }
        Approval approval = approvalMapper.selectOne(new LambdaQueryWrapper<Approval>()
                .eq(Approval::getApprovalCode, approvalId.trim()).last("LIMIT 1"));
        if (approval == null) {
            throw new BusinessException(404, "审批单不存在：" + approvalId);
        }
        return approval;
    }

    /** 页面传数字编码，库里是字符串枚举 —— 必须换算后再查（否则"传数字永远筛不中"） */
    private static List<String> statusTexts(int statusCode) {
        return switch (statusCode) {
            case 2 -> List.of(STATUS_APPROVED, "approved");
            case 3 -> List.of(STATUS_REJECTED, "rejected");
            case 4 -> List.of("WITHDRAWN", "withdrawn");
            default -> List.of(STATUS_PENDING, "pending");
        };
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static Integer toInt(Object value) {
        String text = str(value);
        if (text == null) {
            return null;
        }
        String normalized = text.endsWith(".0") ? text.substring(0, text.length() - 2) : text;
        try {
            return Integer.valueOf(normalized);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
