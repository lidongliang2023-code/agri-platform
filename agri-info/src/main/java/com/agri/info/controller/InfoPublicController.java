package com.agri.info.controller;

import com.agri.common.result.ApiResponse;
import com.agri.info.integration.SupplyDemandService;
import com.agri.info.repository.InfoRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 信息资讯 · 官网门户公开接口。
 *
 * <p>门户是「开放浏览、无需登录」的场景，而 {@link InfoController} 整个类挂了
 * {@code @OperatorOnly("info:consumer")}，匿名访问一律 401 —— 门户首页会直接白屏。
 * 所以单独开一条 {@code /public} 通道：<b>只读</b>，且对私域字段做脱敏。</p>
 *
 * <p>准入由 {@code platform.rbac.public-paths} 放行，不经过权限拦截器。
 * 新增接口前请先确认：它返回的每一个字段都可以给匿名用户看。</p>
 */
@RestController
@RequestMapping("/api/v1/info/public")
public class InfoPublicController {

    /** 匿名访客的身份占位：收藏、订阅、学习进度这类私域数据按它查，天然为空。 */
    private static final String GUEST = "门户访客";

    private final InfoRepository repository;
    private final SupplyDemandService supplyDemandService;

    public InfoPublicController(@Qualifier("infoRepository") InfoRepository repository,
                                SupplyDemandService supplyDemandService) {
        this.repository = repository;
        this.supplyDemandService = supplyDemandService;
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.success(supplyDemandService.fillOverviewStats(repository.overview(GUEST)));
    }

    @GetMapping("/channels")
    public ApiResponse<List<Map<String, Object>>> channels() {
        return ApiResponse.success(repository.channels());
    }

    /**
     * 门户首页头条：运营编排优先，没编排就按时间回退。
     *
     * <p>返回 {@code curated} 标记，前端据此决定要不要打「运营推荐」角标 ——
     * 回退内容和运营精选混在一起、还标着"推荐"，是很容易误导用户的小坑。</p>
     */
    @GetMapping("/recommend")
    public ApiResponse<Map<String, Object>> recommend() {
        return ApiResponse.success(repository.portalRecommend());
    }

    @GetMapping("/articles")
    public ApiResponse<Map<String, Object>> articles(
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String contentType,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int size) {
        return ApiResponse.success(repository.articles(channel, contentType, keyword, page, size));
    }

    @GetMapping("/articles/{id}")
    public ApiResponse<Map<String, Object>> article(@PathVariable long id) {
        return ApiResponse.success(repository.articleDetail(id, GUEST));
    }

    @GetMapping("/markets")
    public ApiResponse<Map<String, Object>> markets(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String market,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.markets(category, market, keyword));
    }

    @GetMapping("/markets/{id}")
    public ApiResponse<Map<String, Object>> market(@PathVariable long id) {
        return ApiResponse.success(repository.marketDetail(id));
    }

    @GetMapping("/indices")
    public ApiResponse<List<Map<String, Object>>> indices() {
        return ApiResponse.success(repository.indices());
    }

    /**
     * 供需大厅公开列表。
     *
     * <p>联系方式是登录后才给的：门户上把电话摆出来，等于把供需库免费送出去，
     * 平台也就失去了"登录才能联系"的转化抓手。</p>
     */
    @GetMapping("/supply-demands")
    public ApiResponse<Map<String, Object>> supplyDemands(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String origin,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int size) {
        Map<String, Object> result = supplyDemandService.list(type, category, origin, sort, keyword, page, size);
        maskContact(result.get("items"));
        return ApiResponse.success(result);
    }

    @GetMapping("/supply-demands/{id}")
    public ApiResponse<Map<String, Object>> supplyDemand(
            @PathVariable long id,
            @RequestParam(required = false) String type) {
        Map<String, Object> detail = supplyDemandService.detail(id, type, null);
        // 洽谈消息属于买卖双方私域，门户不展示
        detail.remove("messages");
        maskContact(List.of(detail));
        return ApiResponse.success(detail);
    }

    @GetMapping("/courses")
    public ApiResponse<Map<String, Object>> courses() {
        return ApiResponse.success(repository.courses(GUEST));
    }

    @GetMapping("/experts")
    public ApiResponse<Map<String, Object>> experts(@RequestParam(required = false) String field) {
        return ApiResponse.success(repository.experts(field));
    }

    @GetMapping("/experts/{id}")
    public ApiResponse<Map<String, Object>> expert(@PathVariable long id) {
        return ApiResponse.success(repository.expertDetail(id));
    }

    @GetMapping("/reports")
    public ApiResponse<Map<String, Object>> reports(@RequestParam(required = false) String category) {
        return ApiResponse.success(repository.reports(category));
    }

    @GetMapping("/reports/{id}")
    public ApiResponse<Map<String, Object>> report(@PathVariable long id) {
        return ApiResponse.success(repository.reportDetail(id));
    }

    @GetMapping("/knowledge")
    public ApiResponse<List<Map<String, Object>>> knowledge(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String crop) {
        return ApiResponse.success(repository.knowledge(keyword, crop));
    }

    @GetMapping("/knowledge/{id}")
    public ApiResponse<Map<String, Object>> knowledgeDetail(@PathVariable long id) {
        return ApiResponse.success(repository.knowledgeDetail(id));
    }

    @GetMapping("/search")
    public ApiResponse<Map<String, Object>> search(@RequestParam(required = false) String keyword) {
        Map<String, Object> result = repository.search(keyword);
        // 供需结果在交易模块，补齐后对匿名访客统一脱敏
        List<Map<String, Object>> sds = supplyDemandService.search(keyword, null, 4);
        maskContact(sds);
        result.put("supplyDemands", sds);
        Object total = result.get("total");
        result.put("total", (total instanceof Number n ? n.intValue() : 0) + sds.size());
        return ApiResponse.success(result);
    }

    @SuppressWarnings("unchecked")
    private void maskContact(Object items) {
        if (!(items instanceof List<?> list)) {
            return;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> row = (Map<String, Object>) map;
                row.remove("contactPhone");
                row.put("contactName", "登录后可见");
                row.put("contactMasked", true);
            }
        }
    }
}
