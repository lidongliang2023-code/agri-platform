package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.ChainRecordContractVO;

import java.util.List;
import java.util.Map;

/**
 * 区块链存证（读）。写操作（提交/补链/重试/验真）见下一轮。
 *
 * <p>只做读，是因为这一段的写路径会牵动"链上交互"这件事（真链 / 模拟链），
 * 那是需要先定口径的；而读路径现在就能让四个存证页面有真实数据可看。</p>
 */
public interface IChainRecordService {

    PageResult<ChainRecordContractVO> page(int pageNum, int pageSize, String status, String bizType, String tenantId);

    ChainRecordContractVO detail(Long recordId, String tenantId);

    /** 按业务查存证（前端 listBlockchainByBiz：/blockchain/by-biz?bizType=&bizId=）。 */
    List<ChainRecordContractVO> listByBiz(String bizType, String bizId, String tenantId);

    /** 概览：总数 / 本月 / 最新区块高度 / 成功率 / 近七日趋势。 */
    Map<String, Object> overview(String tenantId);
}
