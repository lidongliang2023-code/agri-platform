package com.agri.platform.api.facade;

/**
 * 消息中心 OHS 门面：五端触达统一通道（站点内信；短信/推送通道由后续消息触达器扩展）。
 */
public interface MessageFacade {

    void notify(Long userId, Long marketId, String title, String content);
}
