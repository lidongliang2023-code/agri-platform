package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.MatchRecord;
import com.agri.trade.mapper.DemandMapper;
import com.agri.trade.mapper.MatchRecordMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.agri.trade.service.ISmartMatchService;
import com.agri.trade.vo.MatchResultVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@RestController
@RequestMapping("/api/trade/demand")
@RequiredArgsConstructor
public class DemandController {

    private final DemandMapper demandMapper;
    private final MatchRecordMapper matchRecordMapper;
    private final PlatformIdentityService identityService;
    private final ISmartMatchService smartMatchService;

    @GetMapping("/page")
    public ApiResponse<IPage<Demand>> getDemandPage(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) Long buyerId,
            @RequestParam(required = false) String demandStatus,
            // 需求列表页要按需求单号、品类、关键词搜。
            // 原先只有 buyerId 与状态两个条件，页面上的搜框输了字点搜索毫无变化
            // （参数名对不上，Spring 直接忽略）。
            @RequestParam(required = false) String demandNo,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) String keyword) {
        Page<Demand> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Demand> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Demand::getDelFlag, 0);
        if (buyerId != null) wrapper.eq(Demand::getBuyerId, buyerId);
        if (demandStatus != null) wrapper.eq(Demand::getDemandStatus, demandStatus);
        if (demandNo != null && !demandNo.isEmpty()) wrapper.like(Demand::getDemandNo, demandNo);
        if (categoryId != null) wrapper.eq(Demand::getCategoryId, categoryId);
        if (keyword != null && !keyword.isEmpty()) {
            // 关键词同时匹配需求名称 / 商品名称 / 品种：这三个是买家写需求时最可能被搜的字段。
            // 用 and(...or...) 包一层，否则 or 会把前面的 del_flag / 状态条件一起放开。
            wrapper.and(w -> w.like(Demand::getDemandName, keyword)
                    .or().like(Demand::getProductName, keyword)
                    .or().like(Demand::getVariety, keyword));
        }
        wrapper.orderByDesc(Demand::getCreateTime);
        return ApiResponse.success(demandMapper.selectPage(page, wrapper));
    }

    @GetMapping("/{id}")
    public ApiResponse<Demand> getDemandById(@PathVariable Long id) {
        Demand demand = demandMapper.selectById(id);
        if (demand == null) return ApiResponse.error(404, "需求不存在");
        return ApiResponse.success(demand);
    }

    @PostMapping
    public ApiResponse<Demand> createDemand(@RequestBody Demand demand) {
        demand.setDemandNo("DM" + System.currentTimeMillis());
        demand.setDelFlag(0);
        // 状态取值必须与系统其余地方一致：列表/详情的状态标签认的是
        // pending / matching / quoted / completed / closed。
        // 原先这里写 "publish"，新建的需求到列表里就成了一个没人认识的灰标签。
        if (demand.getDemandStatus() == null || demand.getDemandStatus().isEmpty()) {
            demand.setDemandStatus("pending");
        }
        // 采购方 = 当前登录用户绑定的经营主体。
        // 此前取的是平台用户 id —— 与需求/询价/报价/订单链上的主体号不是一个域，
        // 于是"我发布的需求"在列表里按主体号过滤时永远查不到，而且后面整条
        // 询价 → 报价 → 下单链路都把用户 id 当买方号带下去，一路错到底。
        // 代运营代录入时可以点名主体，但必须点的是自己的（selectMerchant 会校验）。
        PlatformIdentityService.MerchantSelection mine = identityService.selectMerchant(demand.getBuyerId());
        if (!mine.ok()) {
            return ApiResponse.error(mine.error());
        }
        demand.setBuyerId(mine.merchantId());
        if (demand.getBuyerName() == null || demand.getBuyerName().isEmpty()) {
            demand.setBuyerName(mine.merchantName());
        }
        String invalid = validateContent(demand);
        if (invalid != null) {
            return ApiResponse.error(invalid);
        }
        Date now = new Date();
        if (demand.getPublishTime() == null) {
            demand.setPublishTime(now);
        }
        demand.setCreateTime(now);
        demand.setUpdateTime(now);
        int result = demandMapper.insert(demand);
        // 返回落库后的对象（含 id / demandNo）：信息资讯的供需大厅要在创建成功后
        // 立刻把联系方式写进自己的关联表，拿不到 id 就没法关联。
        return result > 0 ? ApiResponse.success(demand) : ApiResponse.error("创建失败");
    }

    /**
     * 需求状态词表：与列表页、详情页的状态标签同一口径。
     *
     * <p>改状态必须落在这个表里 —— 原先请求体写什么就落什么，页面上拿到一个没人认识的
     * 灰标签，两个筛选（进行中/未结）也都不认它，那条需求等于从列表里消失了。</p>
     */
    private static final List<String> DEMAND_STATUSES =
            List.of("pending", "matching", "quoted", "completed", "closed");

    @PutMapping("/{id}")
    public ApiResponse<Boolean> updateDemand(@PathVariable Long id, @RequestBody Demand demand) {
        Demand existing = demandMapper.selectById(id);
        if (existing == null) {
            return ApiResponse.error(404, "需求不存在");
        }
        // 原先这条是 demand.setId(id) + updateById(整个请求体)：任何登录用户换个 id 就能把
        // 别家采购需求改成自己的（连 buyerId 都能重写），或者顺手改单号、改状态、置 delFlag。
        String denied = denyUnlessOwner(existing);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        if (demand.getDemandStatus() != null && !demand.getDemandStatus().isEmpty()) {
            if (!DEMAND_STATUSES.contains(demand.getDemandStatus())) {
                return ApiResponse.error("需求状态只能是 pending / matching / quoted / completed / closed 之一");
            }
            existing.setDemandStatus(demand.getDemandStatus());
        }
        // 字段白名单：只有需求内容与交付要求能被页面改。
        // 单号、采购方、发布时间、响应计数、删除标记由服务端持有 —— 让它们可写，
        // 就是让浏览器决定这张单子归谁。
        if (demand.getDemandName() != null) existing.setDemandName(demand.getDemandName());
        if (demand.getProductName() != null) existing.setProductName(demand.getProductName());
        if (demand.getVariety() != null) existing.setVariety(demand.getVariety());
        if (demand.getSpecDesc() != null) existing.setSpecDesc(demand.getSpecDesc());
        if (demand.getQualityLevel() != null) existing.setQualityLevel(demand.getQualityLevel());
        if (demand.getDemandType() != null) existing.setDemandType(demand.getDemandType());
        if (demand.getCategoryId() != null) existing.setCategoryId(demand.getCategoryId());
        // 品类名跟着品类号一起提交（表单两个字段同时给）：只存 id 的话列表那一列是空的。
        if (demand.getCategoryName() != null) existing.setCategoryName(demand.getCategoryName());
        if (demand.getQuantity() != null) existing.setQuantity(demand.getQuantity());
        if (demand.getUnit() != null) existing.setUnit(demand.getUnit());
        if (demand.getPriceMin() != null) existing.setPriceMin(demand.getPriceMin());
        if (demand.getPriceMax() != null) existing.setPriceMax(demand.getPriceMax());
        if (demand.getDeliveryProvince() != null) existing.setDeliveryProvince(demand.getDeliveryProvince());
        if (demand.getDeliveryCity() != null) existing.setDeliveryCity(demand.getDeliveryCity());
        if (demand.getDeliveryDistrict() != null) existing.setDeliveryDistrict(demand.getDeliveryDistrict());
        if (demand.getDeliveryAddress() != null) existing.setDeliveryAddress(demand.getDeliveryAddress());
        if (demand.getDeliveryDeadline() != null) existing.setDeliveryDeadline(demand.getDeliveryDeadline());
        if (demand.getQualityRequirement() != null) existing.setQualityRequirement(demand.getQualityRequirement());
        if (demand.getCertificationRequire() != null) existing.setCertificationRequire(demand.getCertificationRequire());
        if (demand.getSampleRequire() != null) existing.setSampleRequire(demand.getSampleRequire());
        if (demand.getPackagingRequire() != null) existing.setPackagingRequire(demand.getPackagingRequire());
        if (demand.getAdditionalRequirements() != null) existing.setAdditionalRequirements(demand.getAdditionalRequirements());
        if (demand.getValidUntil() != null) existing.setValidUntil(demand.getValidUntil());
        if (demand.getRemark() != null) existing.setRemark(demand.getRemark());
        String invalid = validateContent(existing);
        if (invalid != null) {
            return ApiResponse.error(invalid);
        }
        existing.setUpdateBy(SecurityUtils.getUsername());
        existing.setUpdateTime(new Date());
        int result = demandMapper.updateById(existing);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("更新失败");
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Boolean> deleteDemand(@PathVariable Long id) {
        Demand demand = demandMapper.selectById(id);
        if (demand == null) {
            return ApiResponse.error(404, "需求不存在");
        }
        String denied = denyUnlessOwner(demand);
        if (denied != null) {
            return ApiResponse.error(denied);
        }
        if ("completed".equals(demand.getDemandStatus())) {
            return ApiResponse.error("已成交的需求要留作成交凭据，不能删除（可改为 closed 下架）");
        }
        // 软删必须走 deleteById —— MyBatis-Plus 的全局逻辑删除字段在 updateById 里会被跳过，
        // 写 setDelFlag(1)+updateById 只会改掉 update_time，记录还在（接口却返回成功）。
        int result = demandMapper.deleteById(id);
        return result > 0 ? ApiResponse.success(true) : ApiResponse.error("删除失败");
    }

    @PostMapping("/{id}/match")
    public ApiResponse<List<MatchResultVO>> matchDemand(
            @PathVariable Long id,
            @RequestParam(defaultValue = "5") Integer limit) {
        Demand demand = demandMapper.selectById(id);
        if (demand == null) return ApiResponse.error(404, "需求不存在");
        // 触发撮合会往这张需求上写匹配记录（并给对方货源计一次响应），是主人的动作。
        String denied = denyUnlessOwner(demand);
        if (denied != null) return ApiResponse.error(denied);

        // 这里原先自己拼了一条撮合记录就完事：没有 productId（而该列 NOT NULL，
        // 所以这个接口**一调就是 500**），分数还是写死的 85.50/90/80/85/90，
        // 理由"品类匹配度高，价格符合预期"也是编的 —— 也就是说页面上的
        // 「触发智能撮合」从来没成功过，撮合记录里的那些数据全是 SQL 造进去的。
        //
        // 平台里本来就有真正的撮合引擎（ISmartMatchService：按品类/价格/距离/质量/
        // 信誉/偏好加权打分），而且它自己会把结果落库。这里改成调它。
        List<MatchResultVO> results = smartMatchService.matchDemandToProducts(id, limit);
        if (results.isEmpty()) {
            return ApiResponse.error("没有找到可匹配的货源（该需求的品类/品种下暂无在架货源）");
        }
        return ApiResponse.success(results);
    }

    @GetMapping("/{id}/matches")
    public ApiResponse<List<MatchRecord>> getDemandMatches(@PathVariable Long id) {
        LambdaQueryWrapper<MatchRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MatchRecord::getDemandId, id);
        wrapper.eq(MatchRecord::getDelFlag, 0);
        wrapper.orderByDesc(MatchRecord::getMatchScore);
        return ApiResponse.success(matchRecordMapper.selectList(wrapper));
    }

    /**
     * 判权：这张采购需求必须是我自己主体发布的。
     *
     * <p>需求正文在供需大厅是公开的（看谁的需求、匹配记录都给看），但改内容、下架、
     * 触发撮合是主人的动作 —— 让别人能改，等于能以我的名义改我要买什么、买多少。</p>
     *
     * @return 拒绝原因；允许时返回 null
     */
    private String denyUnlessOwner(Demand demand) {
        PlatformIdentityService.MerchantScope scope = identityService.currentScope();
        if (!scope.resolved()) {
            return scope.error();
        }
        if (demand.getBuyerId() != null && scope.merchantIds().contains(demand.getBuyerId())) {
            return null;
        }
        // 不回显这张单子的买方是谁：连号 id + "这是别家的" 就是免费的探测接口。
        return "这条采购需求不是您名下经营主体发布的，无法修改或下架";
    }

    /**
     * 需求正文的取值校验：数量与价格区间。
     *
     * <p>原先这两个字段一路直插：负数采购量、最低 5000 最高 200 这种区间都进过库，
     * 撮合引擎按价格区间打分时这类需求永远排最后，页面上却显示成"正在匹配"。</p>
     *
     * @return 错误原因；合法时返回 null
     */
    private static String validateContent(Demand demand) {
        if (demand.getQuantity() != null && demand.getQuantity().signum() <= 0) {
            return "采购数量必须大于 0";
        }
        BigDecimal min = demand.getPriceMin();
        BigDecimal max = demand.getPriceMax();
        if (min != null && min.signum() < 0) {
            return "期望价格不能是负数";
        }
        if (max != null && max.signum() < 0) {
            return "期望价格不能是负数";
        }
        if (min != null && max != null && min.compareTo(max) > 0) {
            return "期望最低价不能高于最高价";
        }
        return null;
    }
}
