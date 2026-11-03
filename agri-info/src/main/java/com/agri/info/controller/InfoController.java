package com.agri.info.controller;

import com.agri.common.rbac.OperatorOnly;
import com.agri.common.result.ApiResponse;
import com.agri.info.integration.SupplyDemandService;
import com.agri.info.media.VodSigner;
import com.agri.info.repository.InfoRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 信息资讯 · 用户端接口。
 *
 * <p>准入：平台统一令牌 + {@code info:consumer} 权限（与综合服务 {@code service:consumer} 同一套词表）。
 * 归属：私域数据（供需发布、预警规则、订阅、收藏、AI 问答记录）按 {@code X-Agri-User} 头区分，
 * 该头由前端从统一账号昵称透传；缺失时归入"平台用户"，不会出现跨账号串数据。</p>
 */
@RestController
@RequestMapping("/api/v1/info")
@OperatorOnly("info:consumer")
public class InfoController {

    private final InfoRepository repository;
    private final VodSigner vodSigner;
    private final SupplyDemandService supplyDemandService;

    // 运营端仓储继承自用户端仓储（复用行映射），容器里因此有两个 InfoRepository 候选；
    // 这里按 bean 名精确取用户端那一份，避免注入到运营端实现。
    public InfoController(@Qualifier("infoRepository") InfoRepository repository,
                          VodSigner vodSigner,
                          SupplyDemandService supplyDemandService) {
        this.repository = repository;
        this.vodSigner = vodSigner;
        this.supplyDemandService = supplyDemandService;
    }

    // ---------- 工作台 ----------

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(
                supplyDemandService.fillOverviewStats(repository.overview(repository.owner(user))));
    }

    // ---------- 行情 ----------

    @GetMapping("/markets")
    public ApiResponse<Map<String, Object>> markets(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String market,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(repository.markets(category, market, keyword));
    }

    @GetMapping("/markets/compare")
    public ApiResponse<List<Map<String, Object>>> compare(@RequestParam(required = false) String ids) {
        return ApiResponse.success(repository.compareQuotes(ids));
    }

    @GetMapping("/markets/{id}")
    public ApiResponse<Map<String, Object>> market(@PathVariable long id) {
        return ApiResponse.success(repository.marketDetail(id));
    }

    @GetMapping("/indices")
    public ApiResponse<List<Map<String, Object>>> indices() {
        return ApiResponse.success(repository.indices());
    }

    @GetMapping("/indices/{id}")
    public ApiResponse<Map<String, Object>> index(@PathVariable long id) {
        return ApiResponse.success(repository.indexDetail(id));
    }

    @GetMapping("/forecast")
    public ApiResponse<Map<String, Object>> forecast(
            @RequestParam(required = false, defaultValue = "1") long quoteId,
            @RequestParam(required = false, defaultValue = "7d") String horizon) {
        return ApiResponse.success(repository.forecast(quoteId, horizon));
    }

    // ---------- 资讯 ----------

    @GetMapping("/articles")
    public ApiResponse<Map<String, Object>> articles(
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String contentType,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {
        return ApiResponse.success(repository.articles(channel, contentType, keyword, page, size));
    }

    @GetMapping("/articles/{id}")
    public ApiResponse<Map<String, Object>> article(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.articleDetail(id, repository.owner(user)));
    }

    @PostMapping("/articles/{id}/like")
    public ApiResponse<Map<String, Object>> likeArticle(@PathVariable long id) {
        return ApiResponse.success("已点赞", repository.likeArticle(id));
    }

    @PostMapping("/articles/{id}/comments")
    public ApiResponse<Map<String, Object>> commentArticle(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.commentArticle(id, repository.owner(user), body));
    }

    @GetMapping("/channels")
    public ApiResponse<List<Map<String, Object>>> channels() {
        return ApiResponse.success(repository.channels());
    }

    @GetMapping("/authors")
    public ApiResponse<List<Map<String, Object>>> authors() {
        return ApiResponse.success(repository.authors());
    }

    // ---------- 供需大厅 ----------
    // 数据与撮合全部复用交易撮合模块（供应=agri_trade_product、需求=agri_trade_demand），
    // 本模块只做字段映射与联系方式补充，不再自建一套供需表。

    @GetMapping("/supply-demands")
    public ApiResponse<Map<String, Object>> supplyDemands(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String origin,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int size) {
        return ApiResponse.success(supplyDemandService.list(type, category, origin, sort, keyword, page, size));
    }

    @GetMapping("/supply-demands/mine")
    public ApiResponse<Map<String, Object>> mySupplyDemands(
            @RequestParam(required = false) String type,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        // 我的发布直接读交易模块的"我发布的商品/需求"，按当前用户绑定的经营主体过滤，
        // 不再依赖 X-Agri-User 昵称做私域隔离（那条路和交易侧的主体归属对不上）。
        return ApiResponse.success(Map.of("items", supplyDemandService.mine(authorization, type)));
    }

    @GetMapping("/supply-demands/{id}")
    public ApiResponse<Map<String, Object>> supplyDemand(
            @PathVariable long id,
            @RequestParam(required = false) String type,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ApiResponse.success(supplyDemandService.detail(id, type, authorization));
    }

    /**
     * 发布供需信息（保留给移动端 H5/小程序使用）。
     *
     * <p>PC 用户端已经不再调这个接口：发布表单统一收在交易撮合的卖家中心/买家中心，
     * 信息资讯只提供跳转入口（见前端 {@code SupplyDemandPublishPage}）。
     * 移动端受小程序运行环境限制没法跳到交易端表单，因此仍走这里 ——
     * 写入的仍然是交易模块的商品/需求，不存在第二份数据。</p>
     */
    @PostMapping("/supply-demands")
    public ApiResponse<Map<String, Object>> publishSupplyDemand(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> body) {
        Map<String, Object> result = supplyDemandService.publish(body, authorization, repository.owner(user));
        return ApiResponse.success(String.valueOf(result.get("message")), result);
    }

    @GetMapping("/supply-demands/{id}/matches")
    public ApiResponse<List<Map<String, Object>>> sdMatches(
            @PathVariable long id,
            @RequestParam(required = false) String type,
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return ApiResponse.success(supplyDemandService.matches(id, type, authorization));
    }

    /**
     * 供需详情页的沟通。
     *
     * <p>供应侧走交易模块的店铺洽谈会话（卖家在「我的洽谈」里能收到并回复）；
     * 需求侧没有反向会话模型，仍写本模块的留言表。</p>
     */
    @PostMapping("/supply-demands/{id}/messages")
    public ApiResponse<Map<String, Object>> sendSdMessage(
            @PathVariable long id,
            @RequestParam(required = false) String type,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody Map<String, Object> body) {
        if (!"demand".equalsIgnoreCase(type)) {
            return ApiResponse.success(supplyDemandService.sendChatMessage(
                    id, body == null ? Map.of() : body, authorization, repository.owner(user)));
        }
        // 需求侧：先向交易模块确认这条需求确实存在（id 来自交易模块），再落本地留言，
        // 避免有人拿任意数字往 info_sd_message 里灌数据。
        supplyDemandService.detail(id, "demand", authorization);
        return ApiResponse.success(repository.sendSdMessage(id, repository.owner(user), body));
    }

    // ---------- 培训与知识库 ----------

    @GetMapping("/courses")
    public ApiResponse<Map<String, Object>> courses(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.courses(repository.owner(user)));
    }

    @PostMapping("/courses/{id}/enroll")
    public ApiResponse<Map<String, Object>> enroll(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.enrollCourse(id, repository.owner(user)));
    }

    /**
     * 课程详情：元信息 + 章节目录 + 我的学习进度。
     *
     * <p>目录里不含播放地址，地址走下面的 play-ticket 逐节换取。</p>
     */
    @GetMapping("/courses/{id}")
    public ApiResponse<Map<String, Object>> courseDetail(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.courseDetail(id, repository.owner(user)));
    }

    /**
     * 播放票据：校验「平台令牌 + info:consumer + 报名/试看」后签发短时签名地址。
     *
     * <p>返回相对地址（以 /vod/ 开头），由各端拼自己的 origin ——
     * 小程序与 App 的域名与 H5 不同，后端写死绝对地址会让两端都播不了。</p>
     */
    @PostMapping("/courses/{id}/lessons/{lessonId}/play-ticket")
    public ApiResponse<Map<String, Object>> playTicket(
            @PathVariable long id,
            @PathVariable long lessonId,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        Map<String, Object> lesson = repository.lessonForPlay(id, lessonId, repository.owner(user));
        Map<String, Object> ticket = new LinkedHashMap<>();
        ticket.put("lessonId", lessonId);
        ticket.put("title", lesson.get("title"));
        ticket.put("mediaType", lesson.get("mediaType"));
        ticket.put("durationSec", lesson.get("durationSec"));
        ticket.put("url", vodSigner.buildPlayUrl(String.valueOf(lesson.get("videoUrl"))));
        ticket.put("expiresIn", vodSigner.ticketTtlSeconds());
        return ApiResponse.success(ticket);
    }

    /** 学习进度上报。前端每 15 秒、以及暂停/播完时各调用一次。 */
    @PostMapping("/courses/{id}/lessons/{lessonId}/progress")
    public ApiResponse<Map<String, Object>> reportProgress(
            @PathVariable long id,
            @PathVariable long lessonId,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(repository.reportProgress(
                id, lessonId, repository.owner(user), body == null ? Map.of() : body));
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

    // ---------- AI ----------

    @PostMapping("/ai/qa")
    public ApiResponse<Map<String, Object>> askAi(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.askAi(body, repository.owner(user)));
    }

    @PostMapping("/ai/pest")
    public ApiResponse<Map<String, Object>> pestIdentify(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.pestIdentify(body, repository.owner(user)));
    }

    @GetMapping("/ai/records")
    public ApiResponse<List<Map<String, Object>>> qaRecords(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.qaRecords(repository.owner(user)));
    }

    // ---------- 专家 ----------

    @GetMapping("/experts")
    public ApiResponse<Map<String, Object>> experts(@RequestParam(required = false) String field) {
        return ApiResponse.success(repository.experts(field));
    }

    @GetMapping("/experts/mine")
    public ApiResponse<List<Map<String, Object>>> myExpert(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.myExpert(repository.owner(user)));
    }

    @GetMapping("/experts/{id}")
    public ApiResponse<Map<String, Object>> expert(@PathVariable long id) {
        return ApiResponse.success(repository.expertDetail(id));
    }

    @PostMapping("/experts/apply")
    public ApiResponse<Map<String, Object>> applyExpert(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.applyExpert(body, repository.owner(user)));
    }

    // ---------- 报告与存证 ----------

    @GetMapping("/reports")
    public ApiResponse<Map<String, Object>> reports(@RequestParam(required = false) String category) {
        return ApiResponse.success(repository.reports(category));
    }

    @GetMapping("/reports/mine")
    public ApiResponse<List<Map<String, Object>>> myReports(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.myReports(repository.owner(user)));
    }

    @GetMapping("/reports/{id}")
    public ApiResponse<Map<String, Object>> report(@PathVariable long id) {
        return ApiResponse.success(repository.reportDetail(id));
    }

    @PostMapping("/reports/{id}/download")
    public ApiResponse<Map<String, Object>> downloadReport(@PathVariable long id) {
        return ApiResponse.success(repository.downloadReport(id));
    }

    @GetMapping("/attestations")
    public ApiResponse<List<Map<String, Object>>> attestations(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.attestations(repository.owner(user)));
    }

    @GetMapping("/attestations/{id}")
    public ApiResponse<Map<String, Object>> attestation(@PathVariable long id) {
        return ApiResponse.success(repository.attestationDetail(id));
    }

    @PostMapping("/attestations/verify")
    public ApiResponse<Map<String, Object>> verifyAttestation(@RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.verifyAttestation(body));
    }

    // ---------- 预警 / 订阅 / 收藏 ----------

    @GetMapping("/alerts/rules")
    public ApiResponse<List<Map<String, Object>>> alertRules(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.alertRules(repository.owner(user)));
    }

    @PostMapping("/alerts/rules")
    public ApiResponse<Map<String, Object>> createAlertRule(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.createAlertRule(body, repository.owner(user)));
    }

    @PatchMapping("/alerts/rules/{id}")
    public ApiResponse<Map<String, Object>> updateAlertRule(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.updateAlertRule(id, body, repository.owner(user)));
    }

    /** 小程序与部分原生容器不支持 PATCH，保留同语义的 PUT 入口。 */
    @PutMapping("/alerts/rules/{id}")
    public ApiResponse<Map<String, Object>> updateAlertRulePut(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.updateAlertRule(id, body, repository.owner(user)));
    }

    @GetMapping("/alerts/messages")
    public ApiResponse<Map<String, Object>> alertMessages(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.alertMessages(repository.owner(user)));
    }

    @PostMapping("/alerts/messages/read-all")
    public ApiResponse<Map<String, Object>> readAllAlerts(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.readAllAlerts(repository.owner(user)));
    }

    @GetMapping("/subscriptions")
    public ApiResponse<List<Map<String, Object>>> subscriptions(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.subscriptions(repository.owner(user)));
    }

    @PostMapping("/subscriptions")
    public ApiResponse<Map<String, Object>> createSubscription(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.createSubscription(body, repository.owner(user)));
    }

    @PatchMapping("/subscriptions/{id}")
    public ApiResponse<Map<String, Object>> toggleSubscription(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.toggleSubscription(id, body, repository.owner(user)));
    }

    @GetMapping("/favorites")
    public ApiResponse<List<Map<String, Object>>> favorites(
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.favorites(repository.owner(user)));
    }

    @PostMapping("/favorites")
    public ApiResponse<Map<String, Object>> addFavorite(
            @RequestHeader(value = "X-Agri-User", required = false) String user,
            @RequestBody Map<String, Object> body) {
        return ApiResponse.success(repository.addFavorite(body, repository.owner(user)));
    }

    @DeleteMapping("/favorites/{id}")
    public ApiResponse<Map<String, Object>> removeFavorite(
            @PathVariable long id,
            @RequestHeader(value = "X-Agri-User", required = false) String user) {
        return ApiResponse.success(repository.removeFavorite(id, repository.owner(user)));
    }

    // ---------- 搜索 ----------

    @GetMapping("/search")
    public ApiResponse<Map<String, Object>> search(@RequestParam(required = false) String keyword,
                                                   @RequestHeader(value = "Authorization", required = false)
                                                   String authorization) {
        Map<String, Object> result = repository.search(keyword);
        // 供需结果不在 info 库里，补一次交易模块的查询
        List<Map<String, Object>> sds = supplyDemandService.search(keyword, authorization, 4);
        result.put("supplyDemands", sds);
        Object total = result.get("total");
        result.put("total", (total instanceof Number n ? n.intValue() : 0) + sds.size());
        return ApiResponse.success(result);
    }
}
