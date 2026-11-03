package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.service.INlpParseService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 需求文本解析（纯函数，不落库）。
 *
 * <p>这里以前有 {@code POST /nlp/parse-and-create}：名字说要建需求，实际只是 new 了一个
 * 没插库的 {@code Demand} 返回（id 为空），调用方以为发出去了、列表里根本没有那条；
 * 而它的归属人取请求体的 userId，缺省写死 <b>1</b> —— 也就是把一张需求挂到平台里
 * 与业务无关的第一个账号名下。两条都不是这里该做的事：
 * 解析归解析，建单走 {@code POST /api/trade/demand}（采购方由登录令牌推导）。</p>
 *
 * <p>页面上的自然语言建需求因此是三步：<b>解析 → 预填表单 → 用户核对后提交</b>，
 * 中间那步让人能看见并改掉机器猜错的品类、数量与价格。</p>
 */
@RestController
@RequestMapping("/api/trade/nlp")
@RequiredArgsConstructor
public class NlpParseController {

    private final INlpParseService nlpParseService;

    @PostMapping("/parse")
    public ApiResponse<INlpParseService.ParsedDemandResult> parseText(@RequestBody Map<String, String> request) {
        String text = trimmed(request.get("text"));
        if (text == null) {
            return ApiResponse.error("请输入需求文本");
        }
        return ApiResponse.success(nlpParseService.parseAndExtract(text));
    }

    @PostMapping("/extract/product")
    public ApiResponse<String> extractProduct(@RequestBody Map<String, String> request) {
        String text = trimmed(request.get("text"));
        if (text == null) {
            return ApiResponse.error("请输入要抽取的文本");
        }
        return ApiResponse.success(nlpParseService.extractProductName(text));
    }

    @PostMapping("/extract/quantity")
    public ApiResponse<String> extractQuantity(@RequestBody Map<String, String> request) {
        String text = trimmed(request.get("text"));
        if (text == null) {
            return ApiResponse.error("请输入要抽取的文本");
        }
        return ApiResponse.success(nlpParseService.extractQuantity(text));
    }

    @PostMapping("/extract/location")
    public ApiResponse<String> extractLocation(@RequestBody Map<String, String> request) {
        String text = trimmed(request.get("text"));
        if (text == null) {
            return ApiResponse.error("请输入要抽取的文本");
        }
        return ApiResponse.success(nlpParseService.extractLocation(text));
    }

    /** 抽取类实现都是正则匹配，null 文本会直接空指针 → 500；空串则一律按"没输入"处理。 */
    private static String trimmed(String raw) {
        if (raw == null) {
            return null;
        }
        String text = raw.trim();
        return text.isEmpty() ? null : text;
    }
}
