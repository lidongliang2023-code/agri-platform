package com.agri.production.service;

/**
 * 生产域站内消息写入口。
 *
 * <p>只负责把业务结果落到 {@code agri_prod_message_notify}，不做短信/微信等外部通道投递；
 * 调用方必须能明确给出接收人，不能为了"看起来有通知"而广播给整个租户。</p>
 */
public interface IProductionNotificationService {

    /**
     * 发送一条站内消息。
     *
     * @param tenantId   租户
     * @param farmId     关联农场（可空）
     * @param receiverId 接收人（平台侧成员业务标识，可空时发给租户下所有成员）
     * @param type       SYSTEM / TASK / ALERT / QUALITY / APPROVAL
     * @param title      标题
     * @param content    内容
     * @param bizId      业务单号
     * @param linkPath   页面跳转路径
     */
    void notify(String tenantId, String farmId, String receiverId, String type, String title,
                String content, String bizId, String linkPath);
}
