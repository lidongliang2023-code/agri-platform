package com.agri.platform.internal.market;

import com.agri.shared.result.ApiResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/markets")
@RequiredArgsConstructor
public class MarketController {

    private final MarketMapper marketMapper;

    /** 市场列表（登录页市场选择器） */
    @GetMapping
    public ApiResponse<List<MarketEntity>> list() {
        return ApiResponse.ok(marketMapper.selectList(new LambdaQueryWrapper<MarketEntity>()
                .eq(MarketEntity::getStatus, 1)));
    }
}
