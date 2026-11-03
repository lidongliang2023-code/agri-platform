package com.agri.trade.service;

import com.agri.trade.entity.Inquiry;
import com.agri.trade.entity.Quote;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.TradeProduct;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface IInquiryService extends IService<Inquiry> {

    /**
     * 发起询价：针对某张采购需求，向某个货源问价。
     *
     * <p>询价的采购方就是**该采购需求的采购方**（这张表里 buyerId 从需求带过来），
     * 所以"能不能发"取决于"这张需求是不是你的"：调用方把自己的主体列表传进来由服务端校验。
     * 原先的 buyerId 参数其实**从未被使用**（服务内一律取 demand.buyerId），
     * 也就是说任何人都能替别人发起询价 —— 供应商看到的是"某家采购方来问了"。</p>
     *
     * @param buyerScopeMerchantIds 调用方绑定的经营主体列表
     * @return 询价单；需求或货源不存在、或需求不属于调用方时返回 null
     */
    Inquiry createInquiry(Long demandId, Long productId, java.util.Collection<Long> buyerScopeMerchantIds);

    /**
     * 对一张采购需求的多个货源批量发起询价。
     *
     * <p>与 {@link #createInquiry} 同一口径：采购方取自**需求本身**，而这张需求必须先属于
     * 调用方绑定的经营主体。第三个参数以前是单个 buyerId，且从未被使用 ——
     * 也就是说任何人都能对别人的需求批量发问。</p>
     *
     * @param buyerScopeMerchantIds 调用方绑定的经营主体列表
     * @return 实际发出的询价单；需求不属于调用方时为空列表
     */
    List<Inquiry> batchCreateInquiries(Long demandId, List<Long> productIds,
                                       java.util.Collection<Long> buyerScopeMerchantIds);

    /**
     * 我发起的询价（按绑定的经营主体过滤）。
     *
     * <p>用作"我的询价"列表：买家发起询价后，需要有个地方看到
     * "这条询价有几家报了价、报价到哪一步了"。没有这个入口的话，
     * 询价发出去就石沉大海 —— 只能靠供应商主动联系。</p>
     */
    List<Inquiry> getInquiriesByScope(java.util.Collection<Long> merchantIds);

    /**
     * 我收到的询价（采购方向我发起、等我报价的）。
     *
     * <p>与"我发起的询价"互为两端：没有这条，供应商在页面上根本看不到谁向我询过价，
     * 也就无从报价 —— 整条链路会在"供应商响应"这一步断掉。</p>
     */
    List<Inquiry> getReceivedInquiriesByScope(java.util.Collection<Long> merchantIds);

    List<Quote> getQuotesByInquiry(Long inquiryId);

    void convertToOrder(Long inquiryId, Long quoteId);
}
