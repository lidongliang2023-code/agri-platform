package com.agri.finance.service;

import com.agri.finance.entity.LoanApplication;
import com.baomidou.mybatisplus.extension.service.IService;
import java.math.BigDecimal;

public interface ILoanApplicationService extends IService<LoanApplication> {
    LoanApplication apply(LoanApplication application);
    LoanApplication review(String id, String result, String opinion, BigDecimal amount, BigDecimal rate);
}