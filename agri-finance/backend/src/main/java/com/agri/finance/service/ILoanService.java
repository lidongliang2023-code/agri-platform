package com.agri.finance.service;

import com.agri.finance.entity.Loan;
import com.baomidou.mybatisplus.extension.service.IService;

public interface ILoanService extends IService<Loan> {
    Loan createLoan(String applicationId);
}