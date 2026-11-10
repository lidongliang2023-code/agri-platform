package com.agri.finance.service;

import com.agri.common.exception.BusinessException;
import com.agri.finance.entity.*;
import com.agri.finance.mapper.*;
import com.agri.finance.service.impl.AssetServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** 每次请求重新核对业务关系，释放质押、结清或撤销认购立即失去跨主体读取资格。 */
@Service
@RequiredArgsConstructor
public class WarehouseMonitorAuthorization {
    private final WarehouseReceiptMapper receipts;
    private final PledgeMapper pledges;
    private final LoanApplicationMapper applications;
    private final LoanMapper loans;
    private final WarehouseMonitorAccessMapper access;
    private final FinanceIdentityService identity;

    public WarehouseReceipt require(String receiptId) {
        if (FinanceIdentityService.currentAuthorization() == null) {
            throw new BusinessException(401, "请先登录后查看仓储监控");
        }
        // 权限必须由认证中心验证，不能用请求头昵称或未验证的 JWT 声明。
        if (!identity.hasPermission("finance:read")) deny();
        WarehouseReceipt receipt = receipts.selectById(receiptId);
        if (receipt == null || !Integer.valueOf(0).equals(receipt.getDelFlag())) {
            throw new BusinessException(404, "仓单不存在");
        }
        if (identity.hasPermission("finance:admin")) return receipt;
        if (identity.hasPermission("finance:borrower")
                && Objects.equals(identity.currentBorrowerId(), receipt.getUserId())) return receipt;
        if (!identity.hasPermission("finance:fund") || !"已质押".equals(receipt.getStatus())
                || receipt.getPledgeId() == null) deny();
        Pledge pledge = pledges.selectById(receipt.getPledgeId());
        if (pledge == null || !Integer.valueOf(0).equals(pledge.getDelFlag())
                || !"已生效".equals(pledge.getStatus())
                || !Objects.equals(receipt.getId(), pledge.getReceiptId())
                || !Objects.equals(receipt.getUserId(), pledge.getUserId())
                || pledge.getApplicationId() == null) deny();
        LoanApplication application = applications.selectById(pledge.getApplicationId());
        if (application == null || !Integer.valueOf(0).equals(application.getDelFlag())
                || !Objects.equals(receipt.getUserId(), application.getUserId())
                || !Set.of("已通过", "已放款").contains(String.valueOf(application.getStatus()))) deny();
        if (pledge.getLoanId() != null) {
            Loan loan = loans.selectById(pledge.getLoanId());
            if (loan == null || !Integer.valueOf(0).equals(loan.getDelFlag())
                    || !Objects.equals(application.getId(), loan.getApplicationId())
                    || !Objects.equals(receipt.getUserId(), loan.getUserId())
                    || !Set.of("还款中", "逾期").contains(String.valueOf(loan.getStatus()))) deny();
        }
        String providerId = identity.currentProviderId();
        if (access.activeFunding(providerId, AssetServiceImpl.approvedApplicationAssetId(application.getId()),
                receipt.getUserId()) <= 0) deny();
        return receipt;
    }

    public Map<String, Object> scope(String receiptId) {
        WarehouseReceipt r = require(receiptId);
        if (r.getBatchId() == null || r.getUserId() == null || r.getBatchNo() == null) {
            throw new BusinessException(409, "仓单缺少生产批次，不能读取仓储监控");
        }
        return Map.of("receiptId", r.getId(), "tenantId", r.getUserId(),
                "batchId", r.getBatchId(), "batchNo", r.getBatchNo());
    }
    private void deny() { throw new BusinessException(403, "无权读取该仓单监控，需要本主体仓单或有效融资认购关系"); }
}
