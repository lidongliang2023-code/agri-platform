package com.agri.s2b2c.integration;

/**
 * 生产域溯源链路不可用（服务不可达、非 2xx、响应结构不对）。
 *
 * <p>刻意与"这个商品没有溯源数据"分开：后者是业务事实，前者是链路故障。
 * 两者如果被压成同一个空列表，页面就会把"链路断了"显示成"这批次没记录"——
 * 消费者与运营读到的结论完全相反，而界面上毫无区别。</p>
 */
public class ProductionTraceUnavailableException extends RuntimeException {

    public ProductionTraceUnavailableException(String message) {
        super(message);
    }
}
