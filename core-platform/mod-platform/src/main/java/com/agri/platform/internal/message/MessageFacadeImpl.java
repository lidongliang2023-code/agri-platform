package com.agri.platform.internal.message;

import com.agri.platform.api.facade.MessageFacade;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 消息中心 OHS 门面实现：站点内信落库。
 */
@Service
@RequiredArgsConstructor
public class MessageFacadeImpl implements MessageFacade {

    private final MessageMapper messageMapper;

    @Override
    public void notify(Long userId, Long marketId, String title, String content) {
        MessageEntity message = new MessageEntity();
        message.setUserId(userId);
        message.setTitle(title);
        message.setContent(content);
        if (marketId != null) {
            message.setMarketId(marketId);
        }
        message.setReadFlag(0);
        messageMapper.insert(message);
    }
}
