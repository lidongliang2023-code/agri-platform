package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.UserMessageVO;

/**
 * 用户端：消息中心（{@code /api/v1/production/messages}）。
 *
 * <p>与同域其它用户端服务同口径：按 {@code TenantContextService} 解析出的租户过滤
 * （消息是"这个经营主体收到的通知"，跨租户可见是错的）。</p>
 */
public interface IUserMessageService {

    /**
     * 消息分页。
     *
     * @param keyword     标题/内容模糊匹配（页面搜索框）
     * @param messageType 页面数值编码 1~4，可空；与 {@link UserMessageVO} 的编码同一套
     * @param isRead      已读/未读筛选，可空
     */
    PageResult<UserMessageVO> page(int pageNum, int pageSize, String tenantId, String keyword,
                                  Integer messageType, Boolean isRead);

    /**
     * 未读条数。
     *
     * <p><b>为什么默认按租户统计而不是"按当前登录人"</b>：页面（BasicLayout 的角标）轮询时不带任何参数，
     * 而本服务拿不到"当前操作人"——演示数据里的 {@code receiver_id} 是平台侧成员编号（DEMO-MEM-xxx），
     * 与本服务的用户体系没有映射。按登录人过滤的结果会恒为 0，角标就永远不亮（那正是平台侧踩过的坑：
     * 角标长期显示 0）。显式传 {@code receiverId} 时按传入值过滤，保留"查某个人"的能力。</p>
     *
     * @param receiverId 可空；传入时只统计该接收人的未读
     */
    int unreadCount(String tenantId, String receiverId);

    /**
     * 标记单条已读（幂等：已读的再标一次不报错，阅读时间保持首次）。
     *
     * @throws com.agri.production.common.exception.BusinessException 消息不存在（404）
     */
    UserMessageVO markRead(String tenantId, String messageId);

    /**
     * 全部标记已读。
     *
     * @return 本次由未读变已读的条数
     */
    int markAllRead(String tenantId);

    /**
     * 删除单条消息（逻辑删除）。
     *
     * @throws com.agri.production.common.exception.BusinessException 消息不存在（404）
     */
    void delete(String tenantId, String messageId);
}
