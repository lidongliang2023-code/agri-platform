package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Cart;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.mapper.CartMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 拼团结算。
 *
 * <p>数据分两层：{@code s2b2c_group_buy} 是活动模板（团价、成团人数、有效期），
 * {@code s2b2c_group_instance} 是「这一团」——有人发起才有，成员记录落在
 * {@code s2b2c_group_buy_order}（原名即团购订单关联，本轮补了 instance_id/consumer_id/role）。</p>
 *
 * <p>结算规则：</p>
 * <ul>
 *   <li>发起人（团长）按 {@code leader_price}，没有配置则按 {@code group_price}；</li>
 *   <li>参团人按 {@code group_price}；</li>
 *   <li>一次只能结算一件活动商品（购物车只勾这一件），数量不超过 {@code per_user_limit}；</li>
 *   <li>拼团价与秒杀价互斥，拼团订单不再叠加秒杀；</li>
 *   <li>满员置 SUCCESS；到期未满置 FAILED —— <b>退款不在这里做</b>，由运营端按团状态处理。</li>
 * </ul>
 */
@Service
public class GroupBuyService {

    private final JdbcTemplate jdbc;
    private final CartMapper cartMapper;
    private final ProductMapper productMapper;
    private final OrderService orderService;
    private final ActivityBudgetService activityBudgetService;

    public GroupBuyService(JdbcTemplate jdbc, CartMapper cartMapper, ProductMapper productMapper,
                           OrderService orderService, ActivityBudgetService activityBudgetService) {
        this.jdbc = jdbc;
        this.cartMapper = cartMapper;
        this.productMapper = productMapper;
        this.orderService = orderService;
        this.activityBudgetService = activityBudgetService;
    }

    public record Activity(Long id, Long productId, String name, BigDecimal singlePrice, BigDecimal groupPrice,
                           BigDecimal leaderPrice, int groupSize, int perUserLimit, int validHours,
                           LocalDateTime startTime, LocalDateTime endTime, String status) {
    }

    private record Instance(Long id, Long groupBuyId, Long leaderConsumerId, int requiredSize, int joinedCount,
                            String status, LocalDateTime expireTime) {
    }

    public Activity activity(Long id) {
        List<Activity> rows = jdbc.query("""
                SELECT id,product_id,name,single_price,group_price,leader_price,group_size,per_user_limit,
                       valid_hours,start_time,end_time,status
                FROM s2b2c_group_buy WHERE id=?
                """, (rs, i) -> new Activity(
                rs.getLong("id"), rs.getLong("product_id"), rs.getString("name"),
                rs.getBigDecimal("single_price"), rs.getBigDecimal("group_price"), rs.getBigDecimal("leader_price"),
                rs.getInt("group_size"), rs.getInt("per_user_limit"), rs.getInt("valid_hours"),
                rs.getTimestamp("start_time").toLocalDateTime(), rs.getTimestamp("end_time").toLocalDateTime(),
                rs.getString("status")), id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Instance instance(Long id) {
        List<Instance> rows = jdbc.query("""
                SELECT id,group_buy_id,leader_consumer_id,required_size,joined_count,status,expire_time
                FROM s2b2c_group_instance WHERE id=?
                """, (rs, i) -> new Instance(
                rs.getLong("id"), rs.getLong("group_buy_id"), rs.getLong("leader_consumer_id"),
                rs.getInt("required_size"), rs.getInt("joined_count"), rs.getString("status"),
                rs.getTimestamp("expire_time").toLocalDateTime()), id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** 惰性过期：读取前把到期未满的团标失败，并同步成员记录状态（没有定时任务也自洽）。 */
    private void expireStale() {
        jdbc.update("""
                UPDATE s2b2c_group_instance SET status='FAILED', update_time=NOW()
                WHERE status='PENDING' AND expire_time<=NOW()
                """);
        jdbc.update("""
                UPDATE s2b2c_group_buy_order g
                JOIN s2b2c_group_instance i ON i.id=g.instance_id
                SET g.status=i.status
                WHERE g.status<>i.status
                """);
    }

    /** 活动详情 + 可参团的团列表。 */
    public Map<String, Object> detail(Long activityId) {
        expireStale();
        Map<String, Object> result = new LinkedHashMap<>();
        Activity act = activity(activityId);
        if (act == null) return result;
        Map<String, Object> activity = new LinkedHashMap<>();
        activity.put("id", act.id());
        activity.put("name", act.name());
        activity.put("productId", act.productId());
        activity.put("singlePrice", act.singlePrice());
        activity.put("groupPrice", act.groupPrice());
        activity.put("leaderPrice", act.leaderPrice());
        activity.put("groupSize", act.groupSize());
        activity.put("perUserLimit", act.perUserLimit());
        activity.put("validHours", act.validHours());
        activity.put("startTime", act.startTime().toString());
        activity.put("endTime", act.endTime().toString());
        activity.put("status", act.status());
        result.put("activity", activity);
        result.put("instances", jdbc.query("""
                SELECT i.id,i.joined_count,i.required_size,i.expire_time,i.leader_consumer_id,
                       COALESCE(c.nickname,'团长') AS leaderName
                FROM s2b2c_group_instance i LEFT JOIN s2b2c_consumer c ON c.id=i.leader_consumer_id
                WHERE i.group_buy_id=? AND i.status='PENDING' AND i.expire_time>NOW()
                ORDER BY i.expire_time ASC LIMIT 20
                """, (rs, idx) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("instanceId", rs.getLong("id"));
            row.put("leaderName", rs.getString("leaderName"));
            row.put("joinedCount", rs.getInt("joined_count"));
            row.put("requiredSize", rs.getInt("required_size"));
            row.put("expireTime", rs.getTimestamp("expire_time").toString());
            return row;
        }, activityId));
        return result;
    }

    /** 我参与的团。 */
    public List<Map<String, Object>> myGroups(Long consumerId) {
        expireStale();
        return jdbc.query("""
                SELECT g.instance_id,g.order_id,g.role,g.status AS memberStatus,i.status AS instanceStatus,
                       i.joined_count,i.required_size,i.expire_time,b.name,b.id AS groupBuyId,b.product_id,
                       p.name AS productName
                FROM s2b2c_group_buy_order g
                JOIN s2b2c_group_instance i ON i.id=g.instance_id
                JOIN s2b2c_group_buy b ON b.id=i.group_buy_id
                LEFT JOIN s2b2c_product p ON p.id=b.product_id
                WHERE g.consumer_id=? ORDER BY g.create_time DESC LIMIT 50
                """, (rs, idx) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("instanceId", rs.getLong("instance_id"));
            row.put("orderId", rs.getLong("order_id"));
            row.put("role", rs.getString("role"));
            row.put("status", rs.getString("instanceStatus"));
            row.put("joinedCount", rs.getInt("joined_count"));
            row.put("requiredSize", rs.getInt("required_size"));
            row.put("expireTime", rs.getTimestamp("expire_time").toString());
            row.put("groupBuyId", rs.getLong("groupBuyId"));
            row.put("groupBuyName", rs.getString("name"));
            row.put("productName", rs.getString("productName"));
            return row;
        }, consumerId);
    }

    /**
     * 创建拼团订单：校验活动与购物车 → 定价 → 建单 → 登记团与成员。
     * 任一步失败整体回滚，不会出现「订单建了但没进团」。
     */
    @Transactional
    public List<Long> createGroupOrder(Order order) {
        Activity act = activity(order.getGroupBuyId());
        LocalDateTime now = LocalDateTime.now();
        if (act == null || !"ACTIVE".equals(act.status())) {
            throw new IllegalArgumentException("拼团活动不存在或已下线");
        }
        if (now.isBefore(act.startTime()) || now.isAfter(act.endTime())) {
            throw new IllegalArgumentException("拼团活动不在有效期内");
        }

        List<Cart> carts = cartMapper.selectList(new LambdaQueryWrapper<Cart>()
                .eq(Cart::getConsumerId, order.getConsumerId())
                .eq(Cart::getSelected, true));
        if (carts.isEmpty()) {
            throw new IllegalArgumentException("请先把拼团商品加入购物车并勾选");
        }
        if (carts.size() > 1) {
            throw new IllegalArgumentException("拼团一次只能结算一件活动商品，请只勾选该商品");
        }
        Cart cart = carts.get(0);
        if (!act.productId().equals(cart.getProductId())) {
            throw new IllegalArgumentException("购物车中勾选的商品不属于该拼团活动");
        }
        int quantity = cart.getQuantity() == null ? 0 : cart.getQuantity();
        if (quantity <= 0) {
            throw new IllegalArgumentException("购买数量必须大于 0");
        }
        if (act.perUserLimit() > 0 && quantity > act.perUserLimit()) {
            throw new IllegalArgumentException("该拼团每人限购 " + act.perUserLimit() + " 件");
        }
        Product product = productMapper.selectById(cart.getProductId());
        if (product == null || product.getStock() == null || product.getStock() < quantity) {
            throw new IllegalArgumentException("商品库存不足");
        }

        Long instanceId = order.getGroupInstanceId();
        BigDecimal unitPrice;
        String role;
        if (instanceId == null) {
            // 开团：团长价优先，没配就用团价
            role = "LEADER";
            unitPrice = act.leaderPrice() != null && act.leaderPrice().signum() > 0
                    ? act.leaderPrice() : act.groupPrice();
            instanceId = openInstance(act, order.getConsumerId(), now);
        } else {
            role = "MEMBER";
            unitPrice = act.groupPrice();
            Instance ins = instance(instanceId);
            if (ins == null || !act.id().equals(ins.groupBuyId())) {
                throw new IllegalArgumentException("团不存在或不属于该活动");
            }
            if (!"PENDING".equals(ins.status())) {
                throw new IllegalArgumentException("该团已结束，请另开一团");
            }
            if (!ins.expireTime().isAfter(now)) {
                throw new IllegalArgumentException("该团已过期，请另开一团");
            }
            Integer joined = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM s2b2c_group_buy_order WHERE instance_id=? AND consumer_id=?",
                    Integer.class, instanceId, order.getConsumerId());
            if (joined != null && joined > 0) {
                throw new IllegalArgumentException("你已经参加过这个团了");
            }
            // 原子占位：满员/过期时更新 0 行，避免并发下超员
            int taken = jdbc.update("""
                    UPDATE s2b2c_group_instance SET joined_count=joined_count+1, update_time=NOW()
                    WHERE id=? AND status='PENDING' AND joined_count<required_size AND expire_time>NOW()
                    """, instanceId);
            if (taken == 0) {
                throw new IllegalArgumentException("该团已满或已结束，请刷新后另选一团");
            }
        }

        BigDecimal subsidy = act.singlePrice().subtract(unitPrice).max(BigDecimal.ZERO)
                .multiply(BigDecimal.valueOf(quantity));
        if (!activityBudgetService.reserve("GROUP", act.id(), subsidy)) {
            throw new IllegalArgumentException("该拼团活动预算已用完");
        }

        order.setGroupInstanceId(instanceId);
        order.setGroupUnitPrice(unitPrice);
        order.setGroupSubsidy(subsidy);
        List<Long> orderIds = orderService.createSplit(order);
        if (orderIds == null || orderIds.isEmpty()) {
            throw new IllegalStateException("拼团订单创建失败");
        }
        Long orderId = orderIds.get(0);

        jdbc.update("""
                INSERT INTO s2b2c_group_buy_order
                    (id,group_id,order_id,instance_id,consumer_id,leader_id,role,status,create_time)
                VALUES (?,?,?,?,?,?,?,?,NOW())
                """, nextId(), act.id(), orderId, instanceId, order.getConsumerId(),
                instance(instanceId).leaderConsumerId(), role, "PENDING");

        // 满员即成功（required_size=1 时开团立刻成团）
        jdbc.update("""
                UPDATE s2b2c_group_instance SET status='SUCCESS', update_time=NOW()
                WHERE id=? AND status='PENDING' AND joined_count>=required_size
                """, instanceId);
        jdbc.update("""
                UPDATE s2b2c_group_buy_order g JOIN s2b2c_group_instance i ON i.id=g.instance_id
                SET g.status=i.status WHERE g.instance_id=?
                """, instanceId);

        return orderIds;
    }

    private Long openInstance(Activity act, Long leaderConsumerId, LocalDateTime now) {
        Long id = nextId();
        int required = act.groupSize() > 0 ? act.groupSize() : 2;
        int validHours = act.validHours() > 0 ? act.validHours() : 24;
        // 有效期取「活动结束」与「现在+有效小时」的较早者，避免团比活动活得久
        LocalDateTime expireAt = now.plusHours(validHours).isBefore(act.endTime())
                ? now.plusHours(validHours) : act.endTime();
        jdbc.update("""
                INSERT INTO s2b2c_group_instance
                    (id,group_buy_id,leader_consumer_id,required_size,joined_count,status,expire_time,create_time,update_time)
                VALUES (?,?,?,?,1,'PENDING',?,NOW(),NOW())
                """, id, act.id(), leaderConsumerId, required, Timestamp.valueOf(expireAt));
        return id;
    }

    /** 与 MyBatis-Plus 的 ASSIGN_ID 同风格：雪花算法由 IdWorker 生成，保证与其它表主键不冲突。 */
    private Long nextId() {
        return com.baomidou.mybatisplus.core.toolkit.IdWorker.getId();
    }

    /** 供前端下拉：进行中的活动列表（含可参团数）。 */
    public List<Map<String, Object>> openActivities() {
        expireStale();
        return jdbc.query("""
                SELECT b.id,b.name,b.product_id,b.single_price,b.group_price,b.leader_price,b.group_size,
                       b.valid_hours,b.end_time,p.name AS productName,
                       (SELECT COUNT(*) FROM s2b2c_group_instance i
                         WHERE i.group_buy_id=b.id AND i.status='PENDING' AND i.expire_time>NOW()) AS instanceCount
                FROM s2b2c_group_buy b LEFT JOIN s2b2c_product p ON p.id=b.product_id
                WHERE b.status='ACTIVE' AND b.start_time<=NOW() AND b.end_time>=NOW()
                  AND (b.budget IS NULL OR b.budget_used < b.budget)
                ORDER BY b.end_time ASC
                """, (rs, idx) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", rs.getLong("id"));
            row.put("name", rs.getString("name"));
            row.put("productId", rs.getLong("product_id"));
            row.put("productName", rs.getString("productName"));
            row.put("singlePrice", rs.getBigDecimal("single_price"));
            row.put("groupPrice", rs.getBigDecimal("group_price"));
            row.put("leaderPrice", rs.getBigDecimal("leader_price"));
            row.put("groupSize", rs.getInt("group_size"));
            row.put("validHours", rs.getInt("valid_hours"));
            row.put("endTime", rs.getTimestamp("end_time").toString());
            row.put("instanceCount", rs.getInt("instanceCount"));
            return row;
        });
    }
}
