package com.agri.production.service.impl;

import com.agri.production.common.constant.PlanStatusDict;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Approval;
import com.agri.production.entity.ApprovalFlow;
import com.agri.production.entity.PlantingPlan;
import com.agri.production.mapper.ApprovalFlowMapper;
import com.agri.production.mapper.ApprovalMapper;
import com.agri.production.mapper.PlantingPlanMapper;
import com.agri.production.service.IAdminApprovalService;
import com.agri.production.service.IProductionNotificationService;
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
    private final PlantingPlanMapper plantingPlanMapper;
    private final IProductionNotificationService notificationService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AdminApprovalServiceImpl(ApprovalMapper approvalMapper, ApprovalFlowMapper approvalFlowMapper,
                                    PlantingPlanMapper plantingPlanMapper,
                                    IProductionNotificationService notificationService) {
        this.approvalMapper = approvalMapper;
        this.approvalFlowMapper = approvalFlowMapper;
        this.plantingPlanMapper = plantingPlanMapper;
        this.notificationService = notificationService;
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
        return decide(approvalId, remark, true);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Approval reject(String approvalId, String remark) {
        if (remark == null || remark.isBlank()) {
            throw new BusinessException(400, "驳回时必须填写审批意见");
        }
        return decide(approvalId, remark, false);
    }

    @Override
    public Approval detail(String approvalId) {
        return requireApproval(approvalId);
    }

    private Approval decide(String approvalId, String remark, boolean approved) {
        Approval approval = requireApproval(approvalId);
        if (STATUS_APPROVED.equalsIgnoreCase(approval.getStatus())) {
            throw new BusinessException(400, "该审批单已通过，无需重复审批：" + approvalId);
        }
        if (STATUS_REJECTED.equalsIgnoreCase(approval.getStatus())) {
            throw new BusinessException(400, "该审批单已驳回，如需变更请重新提交：" + approvalId);
        }
        approval.setStatus(approved ? STATUS_APPROVED : STATUS_REJECTED);
        approval.setApproveAt(LocalDateTime.now());
        approval.setApproveOpinion(remark == null || remark.isBlank() ? null : remark.trim());
        approval.setUpdateTime(LocalDateTime.now());
        approvalMapper.updateById(approval);
        syncBusiness(approval, approved);
        log.info("审批{}：{} {}", approved ? "通过" : "驳回", approval.getApprovalCode(), approval.getTitle());
        return approvalMapper.selectById(approval.getId());
    }

    /** 审批结果回写关联业务。当前生产域已接入 PLAN，其它类型保持审批单自身状态。 */
    private void syncBusiness(Approval approval, boolean approved) {
        if (!"PLAN".equalsIgnoreCase(approval.getBizType()) || approval.getBizId() == null) {
            return;
        }
        Long planId;
        try {
            planId = Long.valueOf(approval.getBizId());
        } catch (NumberFormatException e) {
            log.warn("审批单 {} 关联的计划标识不是数字：{}", approval.getApprovalCode(), approval.getBizId());
            return;
        }
        PlantingPlan plan = plantingPlanMapper.selectById(planId);
        if (plan == null || !Integer.valueOf(0).equals(plan.getDeleted())) {
            log.warn("审批单 {} 关联的种养计划不存在或已删除：{}", approval.getApprovalCode(), planId);
            return;
        }
        plan.setPlanStatus(approved ? PlanStatusDict.ACTIVE : PlanStatusDict.DRAFT);
        plan.setApprover(approval.getCurrentApproverId());
        plan.setApprovalComment(approval.getApproveOpinion());
        plan.setApprovalTime(java.sql.Timestamp.valueOf(approval.getApproveAt()));
        plan.setUpdateTime(LocalDateTime.now());
        plantingPlanMapper.updateById(plan);
        notificationService.notify(plan.getTenantId(), String.valueOf(plan.getFarmId()),
                String.valueOf(plan.getManagerId()), "APPROVAL",
                approved ? "种养计划审批通过" : "种养计划审批驳回",
                String.format("计划「%s」%s%s", plan.getPlanName(), approved ? "已通过审批并进入进行中。" : "被驳回，请修改后重新提交。",
                        approval.getApproveOpinion() == null ? "" : "审批意见：" + approval.getApproveOpinion()),
                String.valueOf(plan.getId()), "/production/plans/" + plan.getId());
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteFlow(String flowId) {
        if (flowId == null || flowId.isBlank()) {
            throw new BusinessException(400, "缺少 flowId");
        }
        ApprovalFlow flow = approvalFlowMapper.selectOne(new LambdaQueryWrapper<ApprovalFlow>()
                .eq(ApprovalFlow::getFlowCode, flowId.trim()).last("LIMIT 1"));
        if (flow == null) {
            throw new BusinessException(404, "审批流程不存在：" + flowId);
        }
        approvalFlowMapper.deleteById(flow.getId());
        log.info("删除审批流程：{}", flow.getFlowCode());
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
        boolean hasNodes = payload.containsKey("nodes");
        boolean hasRoutes = payload.containsKey("conditionRoutes");
        boolean hasEscalations = payload.containsKey("escalations");
        if (hasNodes || hasRoutes || hasEscalations) {
            try {
                List<Map<String, Object>> nodes = hasNodes ? listValue(payload.get("nodes")) : currentNodes(flow);
                Map<String, Object> config = new LinkedHashMap<>();
                config.put("nodes", nodes);
                config.put("conditionRoutes", hasRoutes ? listValue(payload.get("conditionRoutes"))
                        : AdminApprovalFlowVO.of(flow).getConditionRoutes());
                config.put("escalations", hasEscalations ? listValue(payload.get("escalations"))
                        : AdminApprovalFlowVO.of(flow).getEscalations());
                flow.setNodesJson(objectMapper.writeValueAsString(config));
            } catch (Exception e) {
                throw new BusinessException(400, "流程配置格式不正确，无法保存");
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> listValue(Object value) {
        if (value instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return List.of();
    }

    private List<Map<String, Object>> currentNodes(ApprovalFlow flow) {
        return AdminApprovalFlowVO.of(flow).getNodes();
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
