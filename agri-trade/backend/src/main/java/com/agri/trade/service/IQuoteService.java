package com.agri.trade.service;

import com.agri.trade.entity.Quote;
import com.agri.trade.entity.TradeOrder;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;

public interface IQuoteService extends IService<Quote> {

    Quote createQuote(Long inquiryId, BigDecimal unitPrice, BigDecimal quantity, 
                      BigDecimal freightAmount, String remark);

    /**
     * 独立报价（不挂询价单）——「报价管理 → 新增报价」走这条。
     *
     * <p>与 {@link #createQuote} 的区别：那条是"卖家回应某张询价单"，主体、品类、
     * 收货地全部继承询价单；这条是卖家自己挂一份报价。</p>
     *
     * <p>卖家身份由**服务端**决定（当前用户绑定的经营主体），不采信请求体里的 sellerId；
     * 总价与有效期也由服务端算 —— 报价单上的金额与时效不能由调用方说了算。</p>
     *
     * @param validDays 有效期天数；为空取默认 7 天，上限 365 天
     */
    Quote createQuoteFromForm(Quote draft, Long sellerId, String sellerName, Integer validDays);

    /**
     * 修改报价（仅限"待审核"且尚未生成订单的报价）。
     *
     * <p>已接受/已转订单的报价不允许改：改了单价就等于把已经成单的金额改掉。</p>
     *
     * @param validDays 为空表示不改有效期
     * @return 是否修改成功
     */
    boolean updateQuoteFromForm(Long id, Quote patch, Integer validDays);

    /**
     * 删除报价（软删，del_flag=1）。
     *
     * <p>已生成订单的报价不允许删：删掉之后订单就找不到来源了。</p>
     */
    boolean deleteQuote(Long id);

    List<Quote> getQuotesByBuyer(Long buyerId);

    List<Quote> getQuotesBySeller(Long sellerId);

    void acceptQuote(Long quoteId);

    void rejectQuote(Long quoteId, String reason);

    Quote getQuoteByInquiryAndSeller(Long inquiryId, Long sellerId);

    /**
     * 报价分页查询。
     *
     * <p>原先只有"按买家/按卖家取全部"和"按询价单取列表"三种查法，没有分页接口 ——
     * 报价列表页因此无处可取数（前端调的是 /api/trade/quote/list，后端根本没有这个路径）。</p>
     */
    IPage<Quote> getQuotePage(int pageNum, int pageSize, String quoteStatus, Long sellerId, Long buyerId);

    /**
     * 报价分页查询（带数据范围）。
     *
     * @param scopeMerchantIds 当前账号绑定的经营主体；为空即"没有范围"，返回空集而不是全量
     */
    IPage<Quote> getQuotePage(int pageNum, int pageSize, String quoteStatus,
                              Long sellerId, Long buyerId, Collection<Long> scopeMerchantIds);

    /** 带报价编号、产品名称关键词和身份范围的分页查询。 */
    IPage<Quote> getQuotePage(int pageNum, int pageSize, String quoteStatus,
                              Long sellerId, Long buyerId, Collection<Long> scopeMerchantIds,
                              String quoteNo, String productName);

    /**
     * 报价转订单。
     *
     * <p>此前这条链路是断的：acceptQuote 只把报价置为 accepted，谁都不生成订单 ——
     * 原型里的"创建订单/确认订单"两页正应该落在这里。</p>
     *
     * <p>幂等：同一份报价只生成一张订单（报价上回写 orderId，重复调用返回已有订单）。</p>
     *
     * @return 生成的订单；报价不存在时返回 null
     */
    TradeOrder convertToOrder(Long quoteId);
}
