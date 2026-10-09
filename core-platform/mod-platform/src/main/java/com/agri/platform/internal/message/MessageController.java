package com.agri.platform.internal.message;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.agri.core.infra.web.MarketContext;
import com.agri.platform.api.facade.MessageFacade;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 消息中心：我的消息列表 / 标记已读。
 */
@RestController
@RequestMapping("/api/v1/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageMapper messageMapper;

    @GetMapping
    public ApiResponse<PageResult<MessageEntity>> myMessages(@RequestParam(defaultValue = "1") long page,
                                                             @RequestParam(defaultValue = "10") long size) {
        Page<MessageEntity> result = messageMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<MessageEntity>()
                        .eq(MessageEntity::getUserId, MarketContext.currentUserId())
                        .orderByDesc(MessageEntity::getCreatedAt));
        return ApiResponse.ok(PageResult.of(result.getRecords(), result.getTotal(), page, size));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<Void> read(@PathVariable Long id) {
        MessageEntity message = messageMapper.selectById(id);
        if (message == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        message.setReadFlag(1);
        messageMapper.updateById(message);
        return ApiResponse.ok();
    }
}
