package com.agri.finance.controller;

import com.agri.common.exception.BusinessException;
import com.agri.common.rbac.OperatorOnly;
import com.agri.finance.entity.Contract;
import com.agri.finance.entity.Loan;
import com.agri.finance.service.FinanceIdentityService;
import com.agri.finance.service.impl.ContractServiceImpl;
import com.agri.finance.service.impl.LoanServiceImpl;
import com.agri.finance.service.impl.MessageNotificationServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 借款合同。
 *
 * <p>签署方不再由请求参数决定：融资方只能签自己名下合同的"融资方"那半边，
 * 资金方/运营签"资金方"那半边并触发放款。原实现里 {@code signType} 由前端传，
 * 融资方自己就能替银行签字，合同两头都是同一个人。</p>
 */
@RestController
@RequestMapping("/api/v1/contract")
public class ContractController {

    private final ContractServiceImpl contractService;
    private final LoanServiceImpl loanService;
    private final FinanceIdentityService identityService;
    private final MessageNotificationServiceImpl messageService;

    public ContractController(ContractServiceImpl contractService,
                              LoanServiceImpl loanService,
                              FinanceIdentityService identityService,
                              MessageNotificationServiceImpl messageService) {
        this.contractService = contractService;
        this.loanService = loanService;
        this.identityService = identityService;
        this.messageService = messageService;
    }

    @GetMapping("/list")
    public Map<String, Object> getContracts(@RequestParam(defaultValue = "") String userId) {
        LambdaQueryWrapper<Contract> query = new LambdaQueryWrapper<>();
        query.eq(Contract::getDelFlag, 0);
        String scope = identityService.scopedBorrowerId(userId);
        if (scope != null) {
            query.eq(Contract::getUserId, scope);
        }
        query.orderByDesc(Contract::getCreatedAt);
        return Map.of("code", 200, "message", "success", "data", contractService.list(query));
    }

    @GetMapping("/{id}")
    public Map<String, Object> getContract(@PathVariable String id) {
        Contract contract = contractService.getById(id);
        if (contract == null) {
            return Map.of("code", 404, "message", "借款合同不存在", "data", "");
        }
        identityService.assertBorrowerOwns(contract.getUserId());
        return Map.of("code", 200, "message", "success", "data", contract);
    }

    /** 融资方签署。 */
    @PostMapping("/sign")
    @OperatorOnly("finance:borrower")
    public Map<String, Object> signContract(@RequestBody Map<String, String> request) {
        String id = request.get("id");
        Contract contract = contractService.getById(id);
        if (contract == null) {
            return Map.of("code", 404, "message", "借款合同不存在", "data", "");
        }
        identityService.assertBorrowerOwns(contract.getUserId());
        return signAndMaybeDisburse(id, "borrower", "签署成功");
    }

    /** 资金方/运营签署。 */
    @PostMapping("/{id}/lender-sign")
    @OperatorOnly("finance:review")
    public Map<String, Object> lenderSign(@PathVariable String id) {
        Contract contract = contractService.getById(id);
        if (contract == null) {
            return Map.of("code", 404, "message", "借款合同不存在", "data", "");
        }
        return signAndMaybeDisburse(id, "lender", "资金方签署完成");
    }

    /**
     * 落签，并在双方签齐时立即放款。
     *
     * <p>放款挂在"最后一笔签名"上而不是单独的放款按钮：谁先签都行，签齐就放，
     * 不会再出现"合同已签完但借款没生成"或"重复点放款生成两笔债"。</p>
     */
    private Map<String, Object> signAndMaybeDisburse(String contractId, String side, String successMessage) {
        Contract signed = contractService.sign(contractId, side);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("contract", signed);
        data.put("disbursed", false);
        if (!contractService.isFullySigned(signed)) {
            messageService.notifyBorrower(signed.getUserId(), "CONTRACT",
                    "borrower".equals(side) ? "合同已签署，等待资金方放款" : "资金方已签署，请完成融资方签署",
                    "借款合同 " + signed.getContractNo() + " 当前签署状态：" + signed.getSignStatus()
                            + "。双方签署完成后系统将自动放款并生成还款计划。",
                    "CONTRACT", signed.getId());
            return Map.of("code", 200, "message", successMessage, "data", data);
        }
        if (signed.getApplicationId() == null) {
            return Map.of("code", 200, "message", successMessage, "data", data);
        }
        Loan loan;
        try {
            loan = loanService.disburse(signed.getApplicationId());
        } catch (BusinessException error) {
            return Map.of("code", error.getCode(), "message", error.getMessage(), "data", signed);
        }
        data.put("loan", loan);
        data.put("disbursed", true);
        messageService.notifyBorrower(signed.getUserId(), "LOAN", "借款已放款",
                "借款合同 " + signed.getContractNo() + " 双方签署完成，借款 "
                        + loan.getLoanNo() + " 已放款 " + loan.getAmount() + " 元，还款计划已生成。",
                "LOAN", loan.getId());
        return Map.of("code", 200, "message", successMessage, "data", data);
    }
}
