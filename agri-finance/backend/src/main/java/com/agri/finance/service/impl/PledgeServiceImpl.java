package com.agri.finance.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.finance.entity.Loan;
import com.agri.finance.entity.LoanApplication;
import com.agri.finance.entity.Pledge;
import com.agri.finance.entity.PledgeGoods;
import com.agri.finance.entity.WarehouseReceipt;
import com.agri.finance.mapper.PledgeMapper;
import com.agri.finance.service.FinanceIdentityService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 质押（仓单 → 借款之间的担保环节）。
 *
 * <p>口径：质押的是<b>一张仓单</b>，不是手填的"质押物类型+数量+单价"。
 * 品类、数量、估值、仓库都从仓单取，金融侧只决定折算率（上限来自质押物字典）。
 * 原来手填那一版没有任何东西可以和生产域对账，仓单和真实库存能差一整批货。</p>
 *
 * <p>状态机：{@code 待审核 → 已生效 → 已释放}。释放有两条路：借款结清自动释放，
 * 或运营人工释放（提前还款、更换质押物）；两边都会把对应仓单一起放行。</p>
 */
@Slf4j
@Service
public class PledgeServiceImpl extends ServiceImpl<PledgeMapper, Pledge> {

    private final MessageNotificationServiceImpl messageService;
    private final WarehouseReceiptServiceImpl receiptService;
    private final PledgeGoodsServiceImpl pledgeGoodsService;
    private final LoanApplicationServiceImpl loanApplicationService;
    private final FinanceIdentityService identityService;

    public PledgeServiceImpl(MessageNotificationServiceImpl messageService,
                             WarehouseReceiptServiceImpl receiptService,
                             PledgeGoodsServiceImpl pledgeGoodsService,
                             LoanApplicationServiceImpl loanApplicationService,
                             FinanceIdentityService identityService) {
        this.messageService = messageService;
        this.receiptService = receiptService;
        this.pledgeGoodsService = pledgeGoodsService;
        this.loanApplicationService = loanApplicationService;
        this.identityService = identityService;
    }

    /**
     * 发起质押：按仓单建立，并占用该仓单（待质押 → 已质押）。
     *
     * <p>仓单被占用是这一步的关键副作用：如果只在质押表里记一个仓单号、不改变仓单状态，
     * 同一张仓单可以被反复提交质押，运营端看到的担保物价值就是同一批货的若干倍。</p>
     */
    @Transactional
    public Pledge createPledge(Pledge pledge) {
        String borrowerId = identityService.currentBorrowerId();
        // 主键一律由服务端生成：让调用方带 id 就等于允许它认领一个它挑好的单据号
        pledge.setId(null);
        pledge.setLoanId(null);
        pledge.setReleaseDate(null);
        pledge.setUserId(borrowerId);
        if (pledge.getReceiptId() == null || pledge.getReceiptId().isBlank()) {
            throw new BusinessException(400, "请先在「仓单与质押」里选一张自己的仓单再发起质押；"
                    + "没有仓单就先按已入库的采收批次开一张");
        }
        WarehouseReceipt receipt = receiptService.getById(pledge.getReceiptId());
        if (receipt == null || Integer.valueOf(1).equals(receipt.getDelFlag())) {
            throw new BusinessException(404, "仓单不存在");
        }
        identityService.assertBorrowerOwns(receipt.getUserId());
        if (!WarehouseReceiptServiceImpl.TO_PLEDGE.equals(receipt.getStatus())) {
            throw new BusinessException(409, "仓单 " + receipt.getReceiptNo() + " 当前状态「"
                    + receipt.getStatus() + "」不能发起质押");
        }
        if (pledge.getApplicationId() != null && !pledge.getApplicationId().isBlank()) {
            LoanApplication application = loanApplicationService.getById(pledge.getApplicationId());
            if (application == null || Integer.valueOf(1).equals(application.getDelFlag())) {
                throw new BusinessException(404, "关联的融资申请不存在：" + pledge.getApplicationId());
            }
            if (!borrowerId.equals(application.getUserId())) {
                throw new BusinessException(403, "融资申请 " + application.getApplicationNo()
                        + " 不属于当前融资主体，不能拿它挂担保");
            }
            if ("已拒绝".equals(application.getStatus())) {
                throw new BusinessException(409, "融资申请 " + application.getApplicationNo() + " 已被拒绝，"
                        + "不能再把仓单挂给它担保");
            }
            pledge.setApplicationId(application.getId());
        } else {
            pledge.setApplicationId(null);
        }
        PledgeGoods goods = goodsOf(receipt.getGoodsCode());
        if (goods != null && !"启用".equals(goods.getStatus())) {
            throw new BusinessException(409, "质押物「" + goods.getGoodsName()
                    + "」已被平台停用，先联系运营处理后再质押");
        }
        BigDecimal rate = pledge.getPledgeRate() == null ? defaultRate(goods) : pledge.getPledgeRate();
        if (rate.signum() <= 0 || rate.compareTo(new BigDecimal("100")) > 0) {
            throw new BusinessException(400, "质押率要落在 0～100 之间");
        }
        BigDecimal cap = goods == null || goods.getPledgeRateMax() == null
                ? new BigDecimal("70") : goods.getPledgeRateMax();
        if (rate.compareTo(cap) > 0) {
            throw new BusinessException(400, "质押物「" + receipt.getCommodityType() + "」的折算率上限是 "
                    + cap.stripTrailingZeros().toPlainString() + "%，不能填 " + rate.stripTrailingZeros().toPlainString()
                    + "%（上限由运营在质押物字典里维护）");
        }
        pledge.setReceiptId(receipt.getId());
        pledge.setCommodityType(receipt.getCommodityType());
        pledge.setQualityStandard(receipt.getQualityStandard());
        pledge.setQuantity(receipt.getQuantity());
        pledge.setUnitPrice(receipt.getUnitPrice());
        pledge.setTotalValue(receipt.getTotalValue());
        pledge.setPledgeRate(rate);
        pledge.setLoanAmount(receipt.getTotalValue().multiply(rate)
                .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP));
        pledge.setWarehouseName(receipt.getWarehouseName());
        pledge.setPledgeNo("FP" + System.currentTimeMillis());
        pledge.setStatus("待审核");
        pledge.setPledgeDate(LocalDateTime.now());
        pledge.setCreatedAt(LocalDateTime.now());
        pledge.setUpdatedAt(LocalDateTime.now());
        pledge.setDelFlag(0);
        save(pledge);
        receiptService.markPledged(receipt.getId(), pledge.getId());
        String chainNote = receipt.getBlockchainHash() == null
                ? "该批次还没有成功的链上存证，审核时需要补存证"
                : "链上存证 " + receipt.getBlockchainHash();
        messageService.notifyBorrower(borrowerId, "PLEDGE", "仓单质押申请已受理",
                "仓单 " + receipt.getReceiptNo() + "（" + receipt.getCommodityType() + " "
                        + receipt.getQuantity().stripTrailingZeros().toPlainString()
                        + nullToEmpty(receipt.getUnit()) + "）已提交质押，估值 " + receipt.getTotalValue()
                        + " 元，可质押金额 " + pledge.getLoanAmount() + " 元，等待平台审核。" + chainNote + "。",
                "PLEDGE", pledge.getId());
        return pledge;
    }

    /** 质押只能沿 待审核 → 已生效 → 已释放 走，跳步会留下"没审核就生效"的质押物。 */
    @Transactional
    public Pledge approvePledge(String id) {
        Pledge pledge = getById(id);
        if (pledge == null || Integer.valueOf(1).equals(pledge.getDelFlag())) {
            throw new BusinessException(404, "质押记录不存在");
        }
        if (!"待审核".equals(pledge.getStatus())) {
            throw new BusinessException(409, "当前状态「" + pledge.getStatus() + "」不能审核生效");
        }
        pledge.setStatus("已生效");
        pledge.setUpdatedAt(LocalDateTime.now());
        updateById(pledge);
        messageService.notifyBorrower(pledge.getUserId(), "PLEDGE", "质押已生效",
                "质押物「" + pledge.getCommodityType() + "」审核通过，可质押金额 "
                        + pledge.getLoanAmount() + " 元。", "PLEDGE", pledge.getId());
        return pledge;
    }

    @Transactional
    public Pledge releasePledge(String id) {
        Pledge pledge = getById(id);
        if (pledge == null || Integer.valueOf(1).equals(pledge.getDelFlag())) {
            throw new BusinessException(404, "质押记录不存在");
        }
        return release(pledge, "平台释放");
    }

    /**
     * 放款后把担保关系从"申请"落到"借款"上。
     *
     * <p>质押是先于放款建立的（担保物是审批的依据），但结清是按借款判的。
     * 不在放款这一步把 {@code loan_id} 写上，结清时就找不到该释放哪张质押，
     * 货主还完钱还押着货。</p>
     */
    @Transactional
    public int linkLoan(String applicationId, String loanId) {
        List<Pledge> pledges = lambdaQuery()
                .eq(Pledge::getApplicationId, applicationId)
                .isNull(Pledge::getLoanId)
                .eq(Pledge::getDelFlag, 0)
                .list();
        for (Pledge pledge : pledges) {
            pledge.setLoanId(loanId);
            pledge.setUpdatedAt(LocalDateTime.now());
            updateById(pledge);
        }
        return pledges.size();
    }

    /**
     * 结清自动释放：这笔借款关联的质押全部放行，仓单一起放行。
     *
     * <p>只放行<b>挂到这笔借款（或它的申请）上</b>的质押。没有挂任何融资的质押不在这里动 ——
     * 它担保的是"这个主体的授信"，放开它等于替融资方决定"我不再需要这笔担保了"，
     * 那条路留给运营在质押列表里人工释放。</p>
     */
    @Transactional
    public List<Pledge> releaseByLoan(Loan loan) {
        List<Pledge> targets = new ArrayList<>();
        List<Pledge> byLoan = lambdaQuery()
                .eq(Pledge::getLoanId, loan.getId())
                .eq(Pledge::getDelFlag, 0)
                .ne(Pledge::getStatus, "已释放")
                .list();
        targets.addAll(byLoan);
        // 老数据（或还没走过 linkLoan 的）按申请号兜一层，避免"已结清却还押着货"
        if (loan.getApplicationId() != null) {
            for (Pledge pledge : lambdaQuery()
                    .eq(Pledge::getApplicationId, loan.getApplicationId())
                    .isNull(Pledge::getLoanId)
                    .eq(Pledge::getDelFlag, 0)
                    .ne(Pledge::getStatus, "已释放")
                    .list()) {
                targets.add(pledge);
            }
        }
        List<Pledge> released = new ArrayList<>();
        for (Pledge pledge : targets) {
            if ("待审核".equals(pledge.getStatus())) {
                // 还没生效的担保不用"释放"，但借款都结清了，仓单不该一直被占着
                pledge.setStatus("已终止");
                pledge.setUpdatedAt(LocalDateTime.now());
                updateById(pledge);
                receiptService.releaseByReceiptId(pledge.getReceiptId(), "借款 " + loan.getLoanNo() + " 结清，未生效质押终止");
                released.add(pledge);
                continue;
            }
            released.add(release(pledge, "借款 " + loan.getLoanNo() + " 已结清"));
        }
        return released;
    }

    private Pledge release(Pledge pledge, String reason) {
        if (!"已生效".equals(pledge.getStatus())) {
            throw new BusinessException(409, "只有已生效的质押才能释放，当前状态：" + pledge.getStatus());
        }
        pledge.setStatus("已释放");
        pledge.setReleaseDate(LocalDateTime.now());
        pledge.setUpdatedAt(LocalDateTime.now());
        updateById(pledge);
        receiptService.releaseByReceiptId(pledge.getReceiptId(), reason);
        messageService.notifyBorrower(pledge.getUserId(), "PLEDGE", "质押物已释放",
                "质押物「" + pledge.getCommodityType() + "」已释放（" + reason
                        + "），对应仓单可以正常出库处置。", "PLEDGE", pledge.getId());
        return pledge;
    }

    private PledgeGoods goodsOf(String goodsCode) {
        if (goodsCode == null || goodsCode.isBlank()) {
            return null;
        }
        return pledgeGoodsService.lambdaQuery()
                .eq(PledgeGoods::getGoodsCode, goodsCode)
                .eq(PledgeGoods::getDelFlag, 0)
                .last("LIMIT 1")
                .one();
    }

    /** 没有指定折算率时按字典上限给（上限本身是风控口径，不是"能填多高就填多高"）。 */
    private BigDecimal defaultRate(PledgeGoods goods) {
        return goods == null || goods.getPledgeRateMax() == null
                ? new BigDecimal("70") : goods.getPledgeRateMax();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
