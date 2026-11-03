package com.agri.trade.service;

import com.agri.trade.entity.MerchantGuarantee;
import com.agri.trade.entity.CompensationRecord;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;
import java.util.List;

public interface IGuaranteeService extends IService<MerchantGuarantee> {

    /** 提交待审核的开立申请，并写入开立流水。 */
    boolean submitGuarantee(MerchantGuarantee guarantee, String operator);

    /**
     * 带操作人与原因的冻结 / 解冻。
     *
     * <p>金额变动要留痕：谁、什么时候、因为什么动的。原因是必填项 ——
     * 冻结商家的钱而不能回答"为什么"，是最容易被投诉也最难自证的一类问题。</p>
     *
     * <p>这里以前另有三个不带操作人的重载（{@code freeze/unfreeze/replenish} 的两参版）、
     * 一条 {@code createGuarantee}（跳过审核直接建生效账户，流水操作人写 "system"），
     * 以及 {@code deductGuarantee} / {@code transferToCompensation}
     * （后者还会绕开 {@code ICompensationService} 自己插一张赔付单）。
     * 它们只被已经下线的 {@code /api/trade/compensation/guarantee/**} 那组路由用过，
     * 没有别的调用方，一并删掉 —— 留着就是"看起来有两套口径，实际只有一套能用"。</p>
     */
    boolean freezeGuarantee(Long guaranteeId, BigDecimal amount, String operator, String reason);

    boolean unfreezeGuarantee(Long guaranteeId, BigDecimal amount, String operator, String reason);

    /** 保证金账户的流水（按时间倒序）。 */
    List<com.agri.trade.entity.GuaranteeLog> getLogs(Long guaranteeId);

    /**
     * 补缴（商家主动加钱）。带操作人与原因，会写一条流水。
     *
     * <p>补缴同样要留痕：保证金是商家的钱，"什么时候加过多少"必须有据可查，
     * 否则对账时只能看一个净额。</p>
     */
    boolean replenishGuarantee(Long guaranteeId, BigDecimal amount, String operator, String reason);

    BigDecimal getAvailableBalance(Long merchantId);

    List<MerchantGuarantee> getGuaranteesByMerchant(Long merchantId);

    /** 审核待开立账户，并同步可用余额与审核流水。 */
    boolean verifyGuarantee(Long guaranteeId, String status, String operator, String remark);
}
