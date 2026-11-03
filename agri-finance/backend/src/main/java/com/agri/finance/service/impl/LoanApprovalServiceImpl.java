package com.agri.finance.service.impl;

import com.agri.finance.entity.Asset;
import com.agri.finance.entity.FinanceApprovalRecord;
import com.agri.finance.entity.FundProvider;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.entity.MessageNotification;
import com.agri.finance.mapper.LoanApplicationMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class LoanApprovalServiceImpl {

    private final LoanApplicationServiceImpl applicationService;
    private final LoanApplicationMapper applicationMapper;
    private final FundProviderServiceImpl providerService;
    private final FinanceApprovalRecordServiceImpl recordService;
    private final AssetServiceImpl assetService;
    private final MessageNotificationServiceImpl messageService;

    public LoanApprovalServiceImpl(
            LoanApplicationServiceImpl applicationService,
            LoanApplicationMapper applicationMapper,
            FundProviderServiceImpl providerService,
            FinanceApprovalRecordServiceImpl recordService,
            AssetServiceImpl assetService,
            MessageNotificationServiceImpl messageService) {
        this.applicationService = applicationService;
        this.applicationMapper = applicationMapper;
        this.providerService = providerService;
        this.recordService = recordService;
        this.assetService = assetService;
        this.messageService = messageService;
    }

    public Map<String, Object> overview(String providerId) {
        List<LoanApplication> applications = applicationService.list(
                new LambdaQueryWrapper<LoanApplication>()
                        .eq(LoanApplication::getDelFlag, 0)
                        .orderByDesc(LoanApplication::getApplyTime)
        );
        Map<String, FinanceApprovalRecord> records = recordService.listByProvider(providerId).stream()
                .collect(Collectors.toMap(
                        FinanceApprovalRecord::getApplicationId,
                        Function.identity(),
                        (left, right) -> left
                ));

        List<Map<String, Object>> items = new ArrayList<>();
        for (LoanApplication application : applications) {
            FinanceApprovalRecord record = records.get(application.getId());
            Asset generatedAsset = assetService.getById(generatedAssetId(application.getId()));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("application", application);
            item.put("approvalRecord", record);
            item.put("generatedAsset", generatedAsset == null ? null : assetService.assetView(generatedAsset));
            item.put("canReview", "待审批".equals(application.getStatus()));
            item.put("providerDecision", record == null ? null : record.getDecision());
            items.add(item);
        }

        List<LoanApplication> pending = applications.stream()
                .filter(item -> "待审批".equals(item.getStatus()))
                .toList();
        List<LoanApplication> approved = applications.stream()
                .filter(item -> "已通过".equals(item.getStatus()))
                .toList();
        List<LoanApplication> rejected = applications.stream()
                .filter(item -> "已拒绝".equals(item.getStatus()))
                .toList();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("pendingCount", pending.size());
        summary.put("pendingAmount", sum(pending));
        summary.put("todayCount", applications.stream()
                .filter(item -> item.getApplyTime() != null
                        && item.getApplyTime().toLocalDate().equals(LocalDate.now()))
                .count());
        summary.put("aiPassCount", pending.stream()
                .filter(item -> "通过".equals(item.getAiReviewResult()))
                .count());
        summary.put("approvedCount", approved.size());
        summary.put("approvedAmount", sum(approved));
        summary.put("rejectedCount", rejected.size());
        summary.put("generatedAssetCount", items.stream()
                .filter(item -> item.get("generatedAsset") != null)
                .count());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("provider", providerService.getById(providerId));
        result.put("summary", summary);
        result.put("items", items);
        result.put("generatedAt", LocalDateTime.now());
        return result;
    }

    @Transactional
    public Map<String, Object> review(
            String applicationId,
            String providerId,
            String providerName,
            String result,
            String opinion,
            BigDecimal amount,
            BigDecimal rate,
            String reviewerId,
            String reviewerName) {
        if (applicationMapper.lockById(applicationId) == null) {
            return failure(404, "融资申请不存在");
        }
        LoanApplication application = applicationService.getById(applicationId);
        if (application == null) {
            return failure(404, "融资申请不存在");
        }
        if (!"待审批".equals(application.getStatus())) {
            return failure(409, "该申请已处理，不能重复审批");
        }
        if (recordService.findByApplication(applicationId, providerId) != null) {
            return failure(409, "该资金机构已提交审批结果");
        }
        FundProvider provider = providerService.getById(providerId);
        if (provider == null
                || !"已通过".equals(provider.getReviewStatus())
                || !Set.of("正常", "ACTIVE").contains(provider.getStatus())) {
            return failure(403, "资金机构尚未通过准入审核");
        }
        if (!Set.of("已通过", "已拒绝").contains(result)) {
            return failure(400, "审批结果不合法");
        }
        if ("已通过".equals(result)) {
            if (amount == null || amount.signum() <= 0
                    || amount.compareTo(application.getApplyAmount()) > 0) {
                return failure(400, "审批金额必须大于 0 且不能超过申请金额");
            }
            if (rate == null || rate.signum() <= 0) {
                return failure(400, "审批利率必须大于 0");
            }
        }

        String safeOpinion = opinion == null || opinion.isBlank()
                ? ("已通过".equals(result) ? "审批通过" : "审批拒绝")
                : opinion.trim();
        LoanApplication reviewed = applicationService.review(
                applicationId,
                result,
                safeOpinion,
                amount,
                rate,
                reviewerId,
                reviewerName
        );
        if (reviewed == null) {
            return failure(409, "申请状态已变化，请刷新后重试");
        }

        FinanceApprovalRecord record = new FinanceApprovalRecord();
        record.setApplicationId(applicationId);
        record.setProviderId(providerId);
        record.setProviderName(providerName == null || providerName.isBlank()
                ? provider.getInstitutionName() : providerName);
        record.setDecision(result);
        record.setApprovedAmount("已通过".equals(result) ? reviewed.getActualAmount() : null);
        record.setApprovedRate("已通过".equals(result) ? reviewed.getActualRate() : null);
        record.setOpinion(safeOpinion);
        record.setReviewerId(reviewerId);
        record.setReviewerName(reviewerName);
        recordService.create(record);

        Asset generatedAsset = null;
        if ("已通过".equals(result)) {
            generatedAsset = assetService.createFromApprovedApplication(reviewed, providerId);
            notifyProvider(providerId, reviewed, generatedAsset);
        }
        notifyBorrower(reviewed, provider, result, safeOpinion, generatedAsset);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("application", reviewed);
        data.put("approvalRecord", record);
        data.put("generatedAsset", generatedAsset == null ? null : assetService.assetView(generatedAsset));
        return Map.of("code", 200, "message", "审批结果已保存", "data", data);
    }

    private void notifyBorrower(
            LoanApplication application,
            FundProvider provider,
            String result,
            String opinion,
            Asset asset) {
        MessageNotification message = new MessageNotification();
        message.setUserId(application.getUserId());
        message.setMessageType("LOAN");
        message.setTitle("融资审批" + ("已通过".equals(result) ? "已通过" : "未通过"));
        message.setContent(provider.getInstitutionName() + "已完成申请 "
                + application.getApplicationNo() + " 的审批。审批意见：" + opinion
                + ("已通过".equals(result) ? "，请确认借款合同。" : "。"));
        message.setRelatedBizType("LOAN_APPLICATION");
        message.setRelatedBizId(application.getId());
        message.setPriority("已通过".equals(result) ? "HIGH" : "MEDIUM");
        message.setStatus("ACTIVE");
        messageService.createMessage(message);
    }

    private void notifyProvider(String providerId, LoanApplication application, Asset asset) {
        MessageNotification message = new MessageNotification();
        message.setUserId(providerId);
        message.setMessageType("ASSET");
        message.setTitle("审批资产已进入市场");
        message.setContent("申请 " + application.getApplicationNo()
                + " 已形成可投资产 " + asset.getAssetNo()
                + "，发行金额 " + asset.getAmount().setScale(2, RoundingMode.HALF_UP).toPlainString() + " 元。");
        message.setRelatedBizType("ASSET");
        message.setRelatedBizId(asset.getId());
        message.setPriority("HIGH");
        message.setStatus("ACTIVE");
        messageService.createMessage(message);
    }

    private BigDecimal sum(List<LoanApplication> applications) {
        return applications.stream()
                .map(LoanApplication::getApplyAmount)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
    }

    private String generatedAssetId(String applicationId) {
        return AssetServiceImpl.approvedApplicationAssetId(applicationId);
    }

    private Map<String, Object> failure(int code, String message) {
        return Map.of("code", code, "message", message, "data", "");
    }
}
