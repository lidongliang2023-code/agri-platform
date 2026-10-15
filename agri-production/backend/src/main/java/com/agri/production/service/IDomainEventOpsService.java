package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.DomainEventContractVO;

import java.util.Map;

/**
 * 领域事件投递的运维口径（台账查询 + 死信重放）。
 *
 * <p>为什么需要它：中继是后台任务，投递失败不该只留在日志里 ——
 * DEAD（死信）如果没有任何入口能看到、能重放，那它就是个黑洞，
 * 消费端就位之后没人知道还有多少事件在等着。</p>
 */
public interface IDomainEventOpsService {

    /** 按状态查事件台账（status 为空 = 全部）。 */
    PageResult<DomainEventContractVO> page(String status, int pageNum, int pageSize, String tenantId);

    /** 各状态条数（NEW / SENT / DEAD），运营端概览用。 */
    Map<String, Object> summary(String tenantId);

    /**
     * 重放：把已投递/死信的事件放回待投递队列（status → NEW，清零重试与失败原因）。
     *
     * <p>只对 SENT / DEAD 有意义：NEW 本来就在队列里，重放它等于假装做了点什么。</p>
     */
    DomainEventContractVO replay(Long id, String tenantId);
}
