package com.agri.finance.service;

import com.agri.finance.entity.CreditScore;
import com.baomidou.mybatisplus.extension.service.IService;

public interface ICreditScoreService extends IService<CreditScore> {
    CreditScore getCreditScore(String userId);
    CreditScore generateCreditReport(String userId);
}