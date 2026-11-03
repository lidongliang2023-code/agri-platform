package com.agri.finance.service;

import com.agri.finance.entity.Contract;
import com.agri.finance.entity.Loan;
import com.baomidou.mybatisplus.extension.service.IService;

public interface ILoanService extends IService<Loan> {

    /** 融资方确认借款：生成（或取回）待签借款合同。 */
    Contract prepareContract(String applicationId);

    /** 放款：合同双方签署后生成借款与还款计划。 */
    Loan disburse(String applicationId);
}
