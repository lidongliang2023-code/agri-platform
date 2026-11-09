package com.agri.s2b2c.controller;

import com.agri.s2b2c.entity.*;
import com.agri.s2b2c.mapper.*;
import com.agri.s2b2c.entity.CommissionRule;
import com.agri.s2b2c.entity.CommissionSettlement;
import com.agri.s2b2c.entity.CommissionWithdrawal;
import com.agri.s2b2c.service.CategoryService;
import com.agri.s2b2c.service.ChannelGradeService;
import com.agri.s2b2c.service.CommissionSettlementService;
import com.agri.s2b2c.service.OrderAutoCompleteService;
import com.agri.s2b2c.service.OrderTimeoutService;
import com.agri.s2b2c.service.SupplierStatementService;
import com.agri.s2b2c.service.SupplierRecruitService;
import com.agri.s2b2c.service.SupplierOnboardingGrantService;
import com.agri.s2b2c.vo.CategoryVO;
import com.agri.s2b2c.vo.ProductVO;
import com.agri.s2b2c.vo.SupplierVO;
import com.agri.common.rbac.OperatorOnly;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/platform")
@OperatorOnly("s2b2c:admin")
public class PlatformController {

    private final SupplierMapper supplierMapper;
    private final ChannelPartnerMapper channelPartnerMapper;
    private final ProductMapper productMapper;
    private final OrderMapper orderMapper;
    private final CategoryService categoryService;
    private final ConsumerMapper consumerMapper;
    private final CommissionRuleMapper commissionRuleMapper;
    private final CommissionWithdrawalMapper commissionWithdrawalMapper;
    private final CommissionSettlementMapper commissionSettlementMapper;
    private final CommissionSettlementService commissionSettlementService;
    private final JdbcTemplate jdbc;
    private final SupplierRecruitService recruitService;
    private final ChannelGradeService channelGradeService;
    private final OrderTimeoutService orderTimeoutService;
    private final OrderAutoCompleteService orderAutoCompleteService;
    private final SupplierStatementService supplierStatementService;
    private final SupplierOnboardingGrantService onboardingGrantService;

    public PlatformController(SupplierMapper supplierMapper, ChannelPartnerMapper channelPartnerMapper,
                              ProductMapper productMapper, OrderMapper orderMapper,
                              CategoryService categoryService, ConsumerMapper consumerMapper,
                              CommissionRuleMapper commissionRuleMapper,
                              CommissionWithdrawalMapper commissionWithdrawalMapper,
                              CommissionSettlementMapper commissionSettlementMapper,
                              CommissionSettlementService commissionSettlementService, JdbcTemplate jdbc,
                              SupplierRecruitService recruitService, ChannelGradeService channelGradeService,
                              OrderTimeoutService orderTimeoutService,
                              OrderAutoCompleteService orderAutoCompleteService,
                              SupplierStatementService supplierStatementService,
                              SupplierOnboardingGrantService onboardingGrantService) {
        this.supplierMapper = supplierMapper;
        this.channelPartnerMapper = channelPartnerMapper;
        this.productMapper = productMapper;
        this.orderMapper = orderMapper;
        this.categoryService = categoryService;
        this.consumerMapper = consumerMapper;
        this.commissionRuleMapper = commissionRuleMapper;
        this.commissionWithdrawalMapper = commissionWithdrawalMapper;
        this.commissionSettlementMapper = commissionSettlementMapper;
        this.commissionSettlementService = commissionSettlementService;
        this.jdbc = jdbc;
        this.recruitService = recruitService;
        this.channelGradeService = channelGradeService;
        this.orderTimeoutService = orderTimeoutService;
        this.orderAutoCompleteService = orderAutoCompleteService;
        this.supplierStatementService = supplierStatementService;
        this.onboardingGrantService = onboardingGrantService;
    }

    @GetMapping("/dashboard")
    @OperatorOnly("s2b2c:read")
    public ResponseEntity<Map<String, Object>> getDashboard() {
        Map<String, Object> result = new HashMap<>();

        long supplierCount = supplierMapper.selectCount(null);
        long channelCount = channelPartnerMapper.selectCount(null);
        long productCount = productMapper.selectCount(null);
        long orderCount = orderMapper.selectCount(null);
        long consumerCount = consumerMapper.selectCount(null);

        BigDecimal totalAmount = orderMapper.selectList(null).stream()
                .map(Order::getPayAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        result.put("supplierCount", supplierCount);
        result.put("channelCount", channelCount);
        result.put("productCount", productCount);
        result.put("orderCount", orderCount);
        result.put("consumerCount", consumerCount);
        result.put("totalAmount", totalAmount);

        return ResponseEntity.ok(result);
    }

    @GetMapping("/suppliers")
    public ResponseEntity<IPage<SupplierVO>> getSuppliers(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String auditStatus) {
        LambdaQueryWrapper<Supplier> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Supplier::getCompanyName, keyword);
        }
        if (auditStatus != null && !auditStatus.isEmpty()) {
            wrapper.eq(Supplier::getAuditStatus, auditStatus);
        }
        wrapper.orderByDesc(Supplier::getCreateTime);

        Page<Supplier> pageQuery = new Page<>(page, size);
        IPage<Supplier> pageResult = supplierMapper.selectPage(pageQuery, wrapper);

        return ResponseEntity.ok(pageResult.convert(s -> {
            SupplierVO vo = new SupplierVO();
            org.springframework.beans.BeanUtils.copyProperties(s, vo);
            return vo;
        }));
    }

    @GetMapping("/supplier/detail/{id}")
    public ResponseEntity<Supplier> getSupplierDetail(@PathVariable Long id) {
        return ResponseEntity.ok(supplierMapper.selectById(id));
    }

    @PutMapping("/supplier/audit")
    public ResponseEntity<Map<String, Object>> auditSupplier(
            @RequestParam Long id,
            @RequestParam String auditStatus,
            @RequestParam(required = false) String auditOpinion) {
        Map<String, Object> result = new HashMap<>();
        Supplier supplier = supplierMapper.selectById(id);
        if (supplier == null) {
            result.put("success", false);
            result.put("message", "供应商不存在");
            return ResponseEntity.ok(result);
        }
        String status = auditStatus == null ? "" : auditStatus.trim().toUpperCase();
        if (!"APPROVED".equals(status) && !"REJECTED".equals(status)) {
            result.put("success", false);
            result.put("message", "审核结果只能是 APPROVED 或 REJECTED");
            return ResponseEntity.ok(result);
        }
        if ("APPROVED".equals(status)) {
            // 平台审核通过即开通业务身份与供货能力：不再让申请人自己去用户中心重复认证。
            // 开通失败则审核不通过（避免出现"显示已通过、工作台却进不去"的半开通状态）。
            try {
                Map<String, Object> grant = onboardingGrantService.grant(supplier);
                result.put("merchantId", grant.get("merchantId"));
                result.put("identityType", grant.get("identityType"));
                result.put("capabilityGranted", grant.get("capabilityGranted"));
            } catch (IllegalStateException e) {
                result.put("success", false);
                result.put("message", e.getMessage());
                return ResponseEntity.ok(result);
            }
        }
        supplier.setAuditStatus(status);
        supplier.setAuditOpinion(auditOpinion);
        supplier.setAuditTime(LocalDateTime.now());
        supplier.setUpdateTime(LocalDateTime.now());
        int count = supplierMapper.updateById(supplier);
        result.put("success", count > 0);
        if (count > 0 && "REJECTED".equals(status)) {
            result.put("message", "已驳回，供应商可修改后重新申请");
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/channel-partners")
    public ResponseEntity<IPage<ChannelPartner>> getChannelPartners(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String auditStatus) {
        LambdaQueryWrapper<ChannelPartner> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(query -> query
                    .like(ChannelPartner::getCompanyName, keyword)
                    .or().like(ChannelPartner::getContactName, keyword)
                    .or().like(ChannelPartner::getShopName, keyword)
                    .or().like(ChannelPartner::getContactPhone, keyword));
        }
        if (auditStatus != null && !auditStatus.isEmpty()) {
            wrapper.eq(ChannelPartner::getAuditStatus, auditStatus);
        }
        wrapper.orderByDesc(ChannelPartner::getCreateTime);

        Page<ChannelPartner> pageQuery = new Page<>(page, size);
        return ResponseEntity.ok(channelPartnerMapper.selectPage(pageQuery, wrapper));
    }

    @GetMapping("/channel-partner/detail/{id}")
    public ResponseEntity<ChannelPartner> getChannelPartnerDetail(@PathVariable Long id) {
        return ResponseEntity.ok(channelPartnerMapper.selectById(id));
    }

    @PutMapping("/channel-partner/audit")
    public ResponseEntity<Map<String, Object>> auditChannelPartner(
            @RequestParam Long id,
            @RequestParam String auditStatus,
            @RequestParam(required = false) String auditOpinion) {
        Map<String, Object> result = new HashMap<>();
        if (!"APPROVED".equals(auditStatus) && !"REJECTED".equals(auditStatus)) {
            result.put("success", false);
            result.put("message", "审核结果只能是 APPROVED 或 REJECTED");
            return ResponseEntity.ok(result);
        }
        ChannelPartner partner = channelPartnerMapper.selectById(id);
        if (partner == null) {
            result.put("success", false);
            result.put("message", "渠道档案不存在");
            return ResponseEntity.ok(result);
        }
        if (!"PENDING".equalsIgnoreCase(partner.getAuditStatus())) {
            // 已处理过的单子不再重复审核，避免覆盖首次审核结论
            result.put("success", false);
            result.put("message", "该渠道已审核过（当前：" + partner.getAuditStatus() + "）");
            return ResponseEntity.ok(result);
        }
        partner.setAuditStatus(auditStatus);
        partner.setAuditOpinion(auditOpinion);
        partner.setAuditTime(LocalDateTime.now());
        partner.setUpdateTime(LocalDateTime.now());
        int count = channelPartnerMapper.updateById(partner);
        if (count > 0) {
            recruitService.onChannelAudit(id, "APPROVED".equals(auditStatus));
        }
        result.put("success", count > 0);
        return ResponseEntity.ok(result);
    }

    /* ==================== 渠道等级 / 佣金规则 ==================== */

    /** 佣金规则列表（按等级排序）。 */
    /** 佣金结算批次列表。 */
    @GetMapping("/commission-settlements")
    public ResponseEntity<List<CommissionSettlement>> settlements() {
        return ResponseEntity.ok(commissionSettlementMapper.selectList(
                new LambdaQueryWrapper<CommissionSettlement>().orderByDesc(CommissionSettlement::getCreatedAt)));
    }

    /**
     * 按渠道/账期批量结算可结算佣金。
     *
     * <p>channelId 为空表示全部渠道；periodStart/periodEnd 可只给一端。
     * 每次结算生成一个批次号并写到佣金行上，便于追溯。</p>
     *
     * <p>回执里必须带 {@code blocked}：能结算的与不能结算的是两回事，
     * 只报"结算 0 笔"会被读成"没有佣金"，而真实原因往往是"订单还没走完"。</p>
     */
    @PostMapping("/commission/settlement")
    public ResponseEntity<Map<String, Object>> settleCommissions(@RequestBody(required = false) Map<String, Object> body) {
        Long channelId;
        try {
            channelId = body == null || body.get("channelId") == null
                    ? null : Long.valueOf(String.valueOf(body.get("channelId")));
        } catch (NumberFormatException invalid) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "渠道 id 不合法"));
        }
        java.time.LocalDate start = body == null || body.get("periodStart") == null
                ? null : java.time.LocalDate.parse(String.valueOf(body.get("periodStart")));
        java.time.LocalDate end = body == null || body.get("periodEnd") == null
                ? null : java.time.LocalDate.parse(String.valueOf(body.get("periodEnd")));
        CommissionSettlementService.SettlementResult result =
                commissionSettlementService.settle(channelId, start, end, currentOperator());
        // 出参三件套：blockedCount / blockedAmount / blocked 明细。
        // 只给一个数不够 —— 页面要能逐条说"这笔为什么没结"，否则操作员只能猜或反复点。
        Map<String, Object> data = new HashMap<>();
        data.put("success", result.count() > 0);
        data.put("batchNo", result.batchNo());
        data.put("count", result.count());
        data.put("amount", result.amount());
        data.put("blockedCount", result.blockedCount());
        data.put("blockedAmount", result.blockedAmount());
        data.put("blocked", result.blocked());
        data.put("message", result.count() > 0
                ? "已结算 " + result.count() + " 笔，批次 " + result.batchNo()
                        + (result.blockedCount() > 0
                                ? "；另有 " + result.blockedCount() + " 笔订单条件未满足：" + blockedSummary(result)
                                : "")
                : (result.blockedCount() == 0
                        ? "所选范围内没有待结算佣金"
                        : "有 " + result.blockedCount() + " 笔待结算佣金，但订单条件还没满足（合计 ¥"
                                + result.blockedAmount() + "）：" + blockedSummary(result)));
        return ResponseEntity.ok(data);
    }

    /** 被挡原因按条数汇总（同一原因合并，最多列三条）。 */
    private String blockedSummary(CommissionSettlementService.SettlementResult result) {
        return result.blocked().stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        CommissionSettlementService.Blocked::reason, java.util.stream.Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(3)
                .map(entry -> entry.getKey() + " " + entry.getValue() + " 笔")
                .collect(java.util.stream.Collectors.joining("；"));
    }

    /** 操作人取令牌账号；取不到写 unknown，不留一个看起来像真名的假字符串。 */
    private String currentOperator() {
        String username = com.agri.s2b2c.security.SecurityUtils.getUsername();
        return username == null || username.isBlank() ? "unknown" : username;
    }

    /** 提现申请列表（运营端）。 */
    @GetMapping("/withdrawals")
    public ResponseEntity<List<Map<String, Object>>> withdrawals(@RequestParam(required = false) String status) {
        List<CommissionWithdrawal> rows = commissionWithdrawalMapper.selectList(
                new LambdaQueryWrapper<CommissionWithdrawal>()
                        .eq(status != null && !status.isBlank(), CommissionWithdrawal::getStatus, status)
                        .orderByDesc(CommissionWithdrawal::getApplyTime));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (CommissionWithdrawal row : rows) {
            ChannelPartner channel = channelPartnerMapper.selectById(row.getChannelId());
            Map<String, Object> item = new HashMap<>();
            item.put("id", row.getId());
            item.put("channelId", row.getChannelId());
            item.put("channelName", channel == null ? null
                    : (channel.getShopName() == null ? channel.getContactName() : channel.getShopName()));
            item.put("amount", row.getAmount());
            item.put("status", row.getStatus());
            item.put("applyTime", row.getApplyTime());
            item.put("reviewer", row.getReviewer());
            item.put("reviewTime", row.getReviewTime());
            item.put("remark", row.getRemark());
            item.put("payoutNo", row.getPayoutNo());
            item.put("payoutOperator", row.getPayoutOperator());
            item.put("payoutTime", row.getPayoutTime());
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * 审核/打款：PENDING → APPROVED/REJECTED；APPROVED → PAID。
     *
     * <p>标记已打款必须登记打款流水号，作为线下打款的凭证；流水号全局唯一，避免同一笔打款重复入账。</p>
     */
    @PutMapping("/withdrawal/{id}/review")
    public ResponseEntity<Map<String, Object>> reviewWithdrawal(@PathVariable Long id,
                                                                @RequestParam String status,
                                                                @RequestParam(required = false) String remark,
                                                                @RequestParam(required = false) String payoutNo) {
        if (!List.of("APPROVED", "REJECTED", "PAID").contains(status)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "状态只能是 APPROVED / REJECTED / PAID"));
        }
        CommissionWithdrawal row = commissionWithdrawalMapper.selectById(id);
        if (row == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "提现申请不存在"));
        }
        boolean legal = ("PENDING".equals(row.getStatus()) && ("APPROVED".equals(status) || "REJECTED".equals(status)))
                || ("APPROVED".equals(row.getStatus()) && "PAID".equals(status));
        if (!legal) {
            return ResponseEntity.ok(Map.of("success", false,
                    "message", "当前状态 " + row.getStatus() + " 不能变更为 " + status));
        }
        String normalizedPayoutNo = payoutNo == null ? "" : payoutNo.trim();
        if ("PAID".equals(status)) {
            if (normalizedPayoutNo.isEmpty()) {
                return ResponseEntity.ok(Map.of("success", false, "message", "标记已打款前请填写打款流水号"));
            }
            Long duplicated = commissionWithdrawalMapper.selectCount(new LambdaQueryWrapper<CommissionWithdrawal>()
                    .eq(CommissionWithdrawal::getPayoutNo, normalizedPayoutNo)
                    .ne(CommissionWithdrawal::getId, id));
            if (duplicated != null && duplicated > 0) {
                return ResponseEntity.ok(Map.of("success", false, "message", "打款流水号已被其他提现单使用"));
            }
            row.setPayoutNo(normalizedPayoutNo);
            row.setPayoutOperator(currentOperator());
            row.setPayoutTime(LocalDateTime.now());
        }
        row.setStatus(status);
        // 审核人与打款操作人都取令牌账号：这两个字段是钱出去时的唯一责任人记录
        row.setReviewer(currentOperator());
        row.setReviewTime(LocalDateTime.now());
        row.setRemark(remark);
        commissionWithdrawalMapper.updateById(row);
        return ResponseEntity.ok(Map.of("success", true, "message", "处理成功，当前状态 " + status));
    }

    @GetMapping("/commission-rules")
    public ResponseEntity<List<CommissionRule>> commissionRules() {
        return ResponseEntity.ok(commissionRuleMapper.selectList(
                new LambdaQueryWrapper<CommissionRule>().orderByAsc(CommissionRule::getGrade)));
    }

    /**
     * 保存佣金规则（按等级 upsert）。
     *
     * <p>rate 是百分比（0-50）。保存后新产生的渠道订单按该规则计算佣金，
     * 已产生的订单佣金不变（历史快照）。</p>
     */
    @PutMapping("/commission-rule")
    public ResponseEntity<Map<String, Object>> saveCommissionRule(@RequestBody Map<String, Object> body) {
        Map<String, Object> result = new HashMap<>();
        String grade = body == null ? null : String.valueOf(body.get("grade"));
        if (grade == null || !grade.matches("LEVEL_[0-9]{1,2}")) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "等级格式应为 LEVEL_n"));
        }
        BigDecimal rate;
        try {
            rate = new BigDecimal(String.valueOf(body.get("rate")));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "佣金比例必须是数字"));
        }
        if (rate.signum() < 0 || rate.compareTo(new BigDecimal("50")) > 0) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "佣金比例应在 0-50 之间"));
        }
        String status = body.get("status") == null ? "ACTIVE" : String.valueOf(body.get("status"));
        String remark = body.get("remark") == null ? null : String.valueOf(body.get("remark"));
        CommissionRule existing = commissionRuleMapper.selectOne(new LambdaQueryWrapper<CommissionRule>()
                .eq(CommissionRule::getGrade, grade).last("LIMIT 1"));
        if (existing == null) {
            CommissionRule rule = new CommissionRule();
            rule.setGrade(grade);
            rule.setRate(rate);
            rule.setStatus(status);
            rule.setRemark(remark);
            commissionRuleMapper.insert(rule);
        } else {
            existing.setRate(rate);
            existing.setStatus(status);
            existing.setRemark(remark);
            commissionRuleMapper.updateById(existing);
        }
        result.put("success", true);
        result.put("message", "佣金规则已保存");
        return ResponseEntity.ok(result);
    }

    /** 调整渠道等级（LEVEL_n）。 */
    @PutMapping("/channel-partner/{id}/grade")
    public ResponseEntity<Map<String, Object>> updateChannelGrade(@PathVariable Long id,
                                                                  @RequestParam String grade) {
        Map<String, Object> result = new HashMap<>();
        if (grade == null || !grade.matches("LEVEL_[0-9]{1,2}")) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "等级格式应为 LEVEL_n"));
        }
        ChannelPartner partner = channelPartnerMapper.selectById(id);
        if (partner == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "渠道档案不存在"));
        }
        partner.setGrade(grade);
        partner.setUpdateTime(LocalDateTime.now());
        result.put("success", channelPartnerMapper.updateById(partner) > 0);
        result.put("message", "渠道等级已调整为 " + grade);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/grade-rules")
    public ResponseEntity<List<Map<String, Object>>> gradeRules() {
        return ResponseEntity.ok(channelGradeService.rules());
    }

    /** 保存等级考核门槛（按 grade upsert）。 */
    @PutMapping("/grade-rule")
    public ResponseEntity<Map<String, Object>> saveGradeRule(@RequestBody Map<String, Object> body) {
        try {
            String grade = body == null ? "" : String.valueOf(body.get("grade")).trim();
            if (!grade.matches("LEVEL_[0-9]{1,2}")) {
                return ResponseEntity.ok(Map.of("success", false, "message", "等级格式应为 LEVEL_n"));
            }
            int minOrders = body.get("minOrders") == null ? 0
                    : Integer.parseInt(String.valueOf(body.get("minOrders")).trim());
            BigDecimal minGmv = body.get("minGmv") == null || String.valueOf(body.get("minGmv")).isBlank()
                    ? BigDecimal.ZERO : new BigDecimal(String.valueOf(body.get("minGmv")).trim());
            if (minOrders < 0 || minGmv.signum() < 0) {
                return ResponseEntity.ok(Map.of("success", false, "message", "订单数与 GMV 门槛不能为负"));
            }
            String status = body.get("status") == null ? "ACTIVE"
                    : String.valueOf(body.get("status")).trim().toUpperCase();
            if (!List.of("ACTIVE", "DISABLED").contains(status)) {
                return ResponseEntity.ok(Map.of("success", false, "message", "状态只能是 ACTIVE / DISABLED"));
            }
            String remark = body.get("remark") == null ? null : String.valueOf(body.get("remark"));
            channelGradeService.saveRule(null, grade, minOrders, minGmv, status, remark);
            return ResponseEntity.ok(Map.of("success", true, "message", "等级考核规则已保存"));
        } catch (RuntimeException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", "订单数与 GMV 门槛必须是数字"));
        }
    }

    /** 立即执行渠道等级考核；规则为空时拒绝执行，避免误降级。 */
    @PostMapping("/channel-grades/evaluate")
    public ResponseEntity<Map<String, Object>> evaluateChannelGrades(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(required = false) Long channelId) {
        try {
            Map<String, Object> result = new HashMap<>(channelGradeService.evaluate(days, currentOperator(), channelId));
            result.put("success", true);
            result.put("message", "考核完成：检查 " + result.get("evaluated") + " 个渠道，调整 "
                    + result.get("changed") + " 个（升 " + result.get("upgrades")
                    + " / 降 " + result.get("downgrades") + "）");
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/channel-grades/changes")
    public ResponseEntity<List<Map<String, Object>>> gradeChanges(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(channelGradeService.changes(limit));
    }

    @GetMapping("/products")
    public ResponseEntity<IPage<ProductVO>> getProducts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        LambdaQueryWrapper<Product> wrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(Product::getName, keyword);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Product::getStatus, status);
        }
        wrapper.orderByDesc(Product::getCreateTime);

        Page<Product> pageQuery = new Page<>(page, size);
        IPage<Product> pageResult = productMapper.selectPage(pageQuery, wrapper);

        return ResponseEntity.ok(pageResult.convert(p -> {
            ProductVO vo = new ProductVO();
            org.springframework.beans.BeanUtils.copyProperties(p, vo);
            return vo;
        }));
    }

    @GetMapping("/product/detail/{id}")
    public ResponseEntity<Product> getProductDetail(@PathVariable Long id) {
        return ResponseEntity.ok(productMapper.selectById(id));
    }

    /**
     * 商品分销准入审核：只处理待审核商品；拒绝必须填写原因；审核动作留痕。
     */
    @PutMapping("/product/audit")
    public ResponseEntity<Map<String, Object>> auditProduct(
            @RequestParam Long id,
            @RequestParam String status,
            @RequestParam(required = false) String opinion) {
        String next = status == null ? "" : status.trim().toUpperCase();
        if (!List.of("APPROVED", "REJECTED").contains(next)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "审核结果只能是 APPROVED / REJECTED"));
        }
        Product product = productMapper.selectById(id);
        if (product == null) {
            return ResponseEntity.ok(Map.of("success", false, "message", "商品不存在"));
        }
        if (!"PENDING".equals(product.getStatus())) {
            return ResponseEntity.ok(Map.of("success", false, "message", "商品已审核过（当前：" + product.getStatus() + "）"));
        }
        if ("REJECTED".equals(next) && (opinion == null || opinion.isBlank())) {
            return ResponseEntity.ok(Map.of("success", false, "message", "拒绝商品必须填写原因"));
        }
        product.setStatus(next);
        product.setAuditOpinion(opinion);
        product.setAuditTime(LocalDateTime.now());
        product.setUpdateTime(LocalDateTime.now());
        productMapper.updateById(product);
        jdbc.update("INSERT INTO s2b2c_product_audit_log (id, product_id, action, opinion, operator, create_time) "
                        + "VALUES (?,?,?,?,?,NOW())",
                IdWorker.getId(), id, next, opinion, currentOperator());
        return ResponseEntity.ok(Map.of("success", true,
                "message", "APPROVED".equals(next) ? "已通过审核" : "已拒绝"));
    }

    /** 批量审核：逐个校验待审核状态，返回成功与跳过数量。 */
    @PostMapping("/products/batch-audit")
    public ResponseEntity<Map<String, Object>> batchAudit(@RequestBody Map<String, Object> body) {
        String next = String.valueOf(body.getOrDefault("status", "")).trim().toUpperCase();
        String opinion = body.get("opinion") == null ? "" : String.valueOf(body.get("opinion")).trim();
        if (!List.of("APPROVED", "REJECTED").contains(next)) {
            return ResponseEntity.ok(Map.of("success", false, "message", "审核结果只能是 APPROVED / REJECTED"));
        }
        if ("REJECTED".equals(next) && opinion.isEmpty()) {
            return ResponseEntity.ok(Map.of("success", false, "message", "批量拒绝必须填写原因"));
        }
        List<?> rawIds = body.get("ids") instanceof List<?> list ? list : List.of();
        int updated = 0;
        int skipped = 0;
        for (Object raw : rawIds) {
            Long id;
            try {
                id = Long.parseLong(String.valueOf(raw).trim());
            } catch (RuntimeException e) {
                skipped++;
                continue;
            }
            Product product = productMapper.selectById(id);
            if (product == null || !"PENDING".equals(product.getStatus())) {
                skipped++;
                continue;
            }
            product.setStatus(next);
            product.setAuditOpinion(opinion);
            product.setAuditTime(LocalDateTime.now());
            product.setUpdateTime(LocalDateTime.now());
            productMapper.updateById(product);
            jdbc.update("INSERT INTO s2b2c_product_audit_log (id, product_id, action, opinion, operator, create_time) "
                            + "VALUES (?,?,?,?,?,NOW())",
                    IdWorker.getId(), id, next, opinion, currentOperator());
            updated++;
        }
        return ResponseEntity.ok(Map.of("success", true, "updated", updated, "skipped", skipped,
                "message", "已处理 " + updated + " 个商品" + (skipped > 0 ? "，跳过 " + skipped + " 个" : "")));
    }

    @GetMapping("/product/{id}/audit-logs")
    public ResponseEntity<List<Map<String, Object>>> auditLogs(@PathVariable Long id) {
        return ResponseEntity.ok(jdbc.queryForList(
                "SELECT id, action, opinion, operator, create_time AS createTime "
                        + "FROM s2b2c_product_audit_log WHERE product_id = ? ORDER BY create_time DESC", id));
    }

    @GetMapping("/categories")
    public ResponseEntity<List<CategoryVO>> getCategories() {
        return ResponseEntity.ok(categoryService.getTree());
    }

    @PostMapping("/category/add")
    public ResponseEntity<Map<String, Object>> addCategory(@RequestBody Category category) {
        Map<String, Object> result = new HashMap<>();
        category.setStatus("ACTIVE");
        int count = categoryService.getBaseMapper().insert(category);
        result.put("success", count > 0);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/category/update")
    public ResponseEntity<Map<String, Object>> updateCategory(@RequestBody Category category) {
        Map<String, Object> result = new HashMap<>();
        int count = categoryService.getBaseMapper().updateById(category);
        result.put("success", count > 0);
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/category/delete/{id}")
    public ResponseEntity<Map<String, Object>> deleteCategory(@PathVariable Long id) {
        Map<String, Object> result = new HashMap<>();
        int count = categoryService.getBaseMapper().deleteById(id);
        result.put("success", count > 0);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/orders")
    @OperatorOnly("s2b2c:read")
    public ResponseEntity<IPage<Order>> getOrders(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Order::getStatus, status);
        }
        if (keyword != null && !keyword.isBlank()) {
            wrapper.like(Order::getOrderNo, keyword.trim());
        }
        wrapper.orderByDesc(Order::getCreateTime);

        Page<Order> pageQuery = new Page<>(page, size);
        return ResponseEntity.ok(orderMapper.selectPage(pageQuery, wrapper));
    }

    /** 手动清理超时未支付订单：与定时任务共用同一套回补逻辑。 */
    @PostMapping("/orders/expire-unpaid")
    public ResponseEntity<Map<String, Object>> expireUnpaidOrders(
            @RequestParam(defaultValue = "30") int minutes) {
        Map<String, Object> result = new HashMap<>(orderTimeoutService.cancelExpired(minutes));
        result.put("success", true);
        result.put("message", "已取消 " + result.get("cancelled") + " 个超时未支付订单");
        return ResponseEntity.ok(result);
    }

    /** 生成供应商供货对账单（按已完成订单的供货价快照）。 */
    @PostMapping("/supplier-statements/generate")
    public ResponseEntity<Map<String, Object>> generateSupplierStatement(@RequestBody Map<String, Object> body) {
        try {
            Long supplierId = Long.parseLong(String.valueOf(body.get("supplierId")));
            java.time.LocalDate start = java.time.LocalDate.parse(String.valueOf(body.get("periodStart")));
            java.time.LocalDate end = java.time.LocalDate.parse(String.valueOf(body.get("periodEnd")));
            return ResponseEntity.ok(supplierStatementService.generate(supplierId, start, end, currentOperator()));
        } catch (RuntimeException e) {
            return ResponseEntity.ok(Map.of("success", false, "message", "请填写正确的供应商 ID 与账期"));
        }
    }

    @GetMapping("/supplier-statements")
    public ResponseEntity<List<Map<String, Object>>> supplierStatements(
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(supplierStatementService.list(supplierId, status));
    }

    @GetMapping("/supplier-statement/{id}")
    public ResponseEntity<Map<String, Object>> supplierStatementDetail(@PathVariable Long id) {
        Map<String, Object> detail = supplierStatementService.detail(id);
        return detail == null ? ResponseEntity.status(404).body(Map.of("message", "对账单不存在"))
                : ResponseEntity.ok(detail);
    }

    /** 手动执行发货后自动确认收货。 */
    @PostMapping("/orders/auto-complete")
    public ResponseEntity<Map<String, Object>> autoCompleteOrders(
            @RequestParam(defaultValue = "7") int days) {
        Map<String, Object> result = new HashMap<>(orderAutoCompleteService.completeExpired(days));
        result.put("success", true);
        result.put("message", "已完成 " + result.get("completed") + " 个超时未收货订单");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/order/detail/{id}")
    @OperatorOnly("s2b2c:read")
    public ResponseEntity<Map<String, Object>> getOrderDetail(@PathVariable Long id) {
        Order order = orderMapper.selectById(id);
        if (order == null) {
            return ResponseEntity.status(404).body(Map.of("message", "订单不存在"));
        }
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("order", order);
        result.put("items", jdbc.queryForList(
                "SELECT id, product_id AS productId, name, spec, price, supply_price AS supplyPrice, "
                        + "quantity, total_amount AS totalAmount, image, flash_sale_id AS flashSaleId, "
                        + "flash_subsidy AS flashSubsidy FROM s2b2c_order_item WHERE order_id = ? ORDER BY id", id));
        result.put("consumer", firstRow(jdbc.queryForList(
                "SELECT id, nickname, phone, avatar, province, city FROM s2b2c_consumer WHERE id = ?",
                order.getConsumerId())));
        result.put("address", order.getAddressId() == null ? null : firstRow(jdbc.queryForList(
                "SELECT id, name, phone, province, city, district, address FROM s2b2c_address WHERE id = ?",
                order.getAddressId())));
        result.put("supplier", order.getSupplierId() == null ? null : firstRow(jdbc.queryForList(
                "SELECT id, company_name AS companyName, shop_name AS shopName, contact_phone AS contactPhone "
                        + "FROM s2b2c_supplier WHERE id = ?", order.getSupplierId())));
        result.put("channel", order.getChannelId() == null ? null : firstRow(jdbc.queryForList(
                "SELECT id, shop_name AS shopName, contact_name AS contactName, contact_phone AS contactPhone, grade "
                        + "FROM s2b2c_channel_partner WHERE id = ?", order.getChannelId())));
        result.put("shipment", firstRow(jdbc.queryForList(
                "SELECT id, status, proposer_type AS proposerType, logistics_no AS logisticsNo, "
                        + "logistics_company AS logisticsCompany, reason, create_time AS createTime "
                        + "FROM s2b2c_order_shipment WHERE order_id = ? "
                        + "ORDER BY create_time DESC, id DESC LIMIT 1", id)));
        result.put("afterSales", jdbc.queryForList(
                "SELECT id, type, reason, amount, status, handle_opinion AS handleOpinion, "
                        + "handle_time AS handleTime, create_time AS createTime "
                        + "FROM s2b2c_after_sale WHERE order_id = ? ORDER BY create_time DESC", id));
        result.put("commission", firstRow(jdbc.queryForList(
                "SELECT id, channel_id AS channelId, amount, rate, status, settle_time AS settleTime, "
                        + "create_time AS createTime FROM s2b2c_commission WHERE order_id = ? LIMIT 1", id)));
        return ResponseEntity.ok(result);
    }

    private Map<String, Object> firstRow(List<Map<String, Object>> rows) {
        return rows == null || rows.isEmpty() ? null : rows.get(0);
    }
}
