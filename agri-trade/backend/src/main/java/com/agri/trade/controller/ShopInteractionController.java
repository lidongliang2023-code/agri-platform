package com.agri.trade.controller;

import com.agri.trade.common.entity.ApiResponse;
import com.agri.trade.common.security.LoginUser;
import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.Negotiation;
import com.agri.trade.entity.NegotiationMessage;
import com.agri.trade.entity.ProductFavorite;
import com.agri.trade.entity.ShopFollow;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.NegotiationMapper;
import com.agri.trade.mapper.NegotiationMessageMapper;
import com.agri.trade.mapper.ProductFavoriteMapper;
import com.agri.trade.mapper.ShopFollowMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.service.PlatformIdentityService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

/**
 * 供应商店铺关注与在线洽谈。
 *
 * <p>关注以平台用户为粒度；洽谈会话以「采购用户 + 供应商主体」唯一。供应商账号
 * 通过平台主体绑定关系参与同一会话，买卖双方都能看到并回复，不是只在浏览器里模拟消息。</p>
 */
@RestController
@RequestMapping("/api/trade/shop-interactions")
@RequiredArgsConstructor
public class ShopInteractionController {

    private final ShopFollowMapper followMapper;
    private final NegotiationMapper negotiationMapper;
    private final NegotiationMessageMapper messageMapper;
    private final ProductFavoriteMapper productFavoriteMapper;
    private final TradeProductMapper productMapper;
    private final PlatformIdentityService identityService;

    @GetMapping("/follow/{sellerId}")
    public ApiResponse<FollowState> followState(@PathVariable Long sellerId) {
        Long userId = currentUserId();
        requireSeller(sellerId);
        Long count = followMapper.selectCount(new LambdaQueryWrapper<ShopFollow>()
                .eq(ShopFollow::getSellerId, sellerId));
        Long mine = followMapper.selectCount(new LambdaQueryWrapper<ShopFollow>()
                .eq(ShopFollow::getSellerId, sellerId)
                .eq(ShopFollow::getUserId, userId));
        return ApiResponse.success(new FollowState(mine != null && mine > 0, count == null ? 0 : count));
    }

    @PostMapping("/follow/{sellerId}")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<FollowState> follow(@PathVariable Long sellerId) {
        Long userId = currentUserId();
        requireSeller(sellerId);
        Long exists = followMapper.selectCount(new LambdaQueryWrapper<ShopFollow>()
                .eq(ShopFollow::getUserId, userId)
                .eq(ShopFollow::getSellerId, sellerId));
        if (exists == null || exists == 0) {
            ShopFollow follow = new ShopFollow();
            follow.setUserId(userId);
            follow.setSellerId(sellerId);
            follow.setCreateTime(LocalDateTime.now());
            followMapper.insert(follow);
        }
        return followState(sellerId);
    }

    /** 当前买家关注的供应商列表。 */
    @GetMapping("/following")
    public ApiResponse<List<FollowingSellerView>> following() {
        Long userId = currentUserId();
        List<ShopFollow> follows = followMapper.selectList(new LambdaQueryWrapper<ShopFollow>()
                .eq(ShopFollow::getUserId, userId)
                .orderByDesc(ShopFollow::getCreateTime));
        List<FollowingSellerView> rows = follows.stream().map(follow -> {
            List<TradeProduct> products = productMapper.selectList(new LambdaQueryWrapper<TradeProduct>()
                    .eq(TradeProduct::getSellerId, follow.getSellerId())
                    .eq(TradeProduct::getDelFlag, 0)
                    .orderByDesc(TradeProduct::getCreateTime)
                    .last("LIMIT 100"));
            TradeProduct latest = products.stream().filter(product -> "published".equals(product.getPublishStatus()))
                    .findFirst().orElse(products.isEmpty() ? null : products.get(0));
            List<TradeProduct> published = products.stream()
                    .filter(product -> "published".equals(product.getPublishStatus())).toList();
            BigDecimal minPrice = published.stream()
                    .map(product -> product.getPrice() == null ? product.getPriceMin() : product.getPrice())
                    .filter(java.util.Objects::nonNull)
                    .min(BigDecimal::compareTo).orElse(null);
            String categories = published.stream().map(TradeProduct::getCategoryName)
                    .filter(value -> value != null && !value.isBlank()).distinct().limit(5)
                    .collect(Collectors.joining("、"));
            return new FollowingSellerView(
                    follow.getSellerId(),
                    latest == null ? "供应商 #" + follow.getSellerId() : latest.getSellerName(),
                    latest == null ? null : latest.getOriginProvince(),
                    latest == null ? null : latest.getOriginCity(),
                    published.size(),
                    minPrice,
                    categories,
                    follow.getCreateTime());
        }).collect(Collectors.toList());
        return ApiResponse.success(rows);
    }

    @DeleteMapping("/follow/{sellerId}")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<FollowState> unfollow(@PathVariable Long sellerId) {
        Long userId = currentUserId();
        requireSeller(sellerId);
        followMapper.delete(new LambdaQueryWrapper<ShopFollow>()
                .eq(ShopFollow::getUserId, userId)
                .eq(ShopFollow::getSellerId, sellerId));
        return followState(sellerId);
    }

    @GetMapping("/favorites/products")
    public ApiResponse<List<FavoriteProductView>> favoriteProducts() {
        Long userId = currentUserId();
        return ApiResponse.success(productFavoriteMapper.selectList(
                        new LambdaQueryWrapper<ProductFavorite>()
                                .eq(ProductFavorite::getUserId, userId)
                                .orderByDesc(ProductFavorite::getCreateTime))
                .stream().map(favorite -> {
                    TradeProduct product = productMapper.selectById(favorite.getProductId());
                    return new FavoriteProductView(
                            favorite.getProductId(),
                            product == null ? "已删除商品" : product.getProductName(),
                            product == null ? null : product.getSellerId(),
                            product == null ? null : product.getSellerName(),
                            product == null ? null : product.getCategoryName(),
                            product == null ? null : (product.getPrice() == null ? product.getPriceMin() : product.getPrice()),
                            product == null ? null : product.getUnit(),
                            product == null ? null : product.getPublishStatus(),
                            favorite.getCreateTime());
                }).collect(Collectors.toList()));
    }

    @GetMapping("/favorites/products/{productId}")
    public ApiResponse<FavoriteState> favoriteProductState(@PathVariable Long productId) {
        Long userId = currentUserId();
        Long count = productFavoriteMapper.selectCount(new LambdaQueryWrapper<ProductFavorite>()
                .eq(ProductFavorite::getUserId, userId)
                .eq(ProductFavorite::getProductId, productId));
        return ApiResponse.success(new FavoriteState(count != null && count > 0));
    }

    @PostMapping("/favorites/products/{productId}")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<FavoriteState> favoriteProduct(@PathVariable Long productId) {
        Long userId = currentUserId();
        TradeProduct product = productMapper.selectById(productId);
        if (product == null || !Integer.valueOf(0).equals(product.getDelFlag())) {
            return ApiResponse.error(404, "商品不存在");
        }
        Long exists = productFavoriteMapper.selectCount(new LambdaQueryWrapper<ProductFavorite>()
                .eq(ProductFavorite::getUserId, userId)
                .eq(ProductFavorite::getProductId, productId));
        if (exists == null || exists == 0) {
            ProductFavorite favorite = new ProductFavorite();
            favorite.setUserId(userId);
            favorite.setProductId(productId);
            favorite.setCreateTime(LocalDateTime.now());
            productFavoriteMapper.insert(favorite);
            product.setFavoriteCount((product.getFavoriteCount() == null ? 0 : product.getFavoriteCount()) + 1);
            productMapper.updateById(product);
        }
        return ApiResponse.success(new FavoriteState(true));
    }

    @DeleteMapping("/favorites/products/{productId}")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<FavoriteState> unfavoriteProduct(@PathVariable Long productId) {
        Long userId = currentUserId();
        int removed = productFavoriteMapper.delete(new LambdaQueryWrapper<ProductFavorite>()
                .eq(ProductFavorite::getUserId, userId)
                .eq(ProductFavorite::getProductId, productId));
        if (removed > 0) {
            TradeProduct product = productMapper.selectById(productId);
            if (product != null) {
                product.setFavoriteCount(Math.max(0,
                        (product.getFavoriteCount() == null ? 0 : product.getFavoriteCount()) - 1));
                productMapper.updateById(product);
            }
        }
        return ApiResponse.success(new FavoriteState(false));
    }

    /** 打开店铺客服会话；同一买家与同一供应商始终复用一条会话。 */
    @PostMapping("/negotiations/open")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<ConversationView> open(@RequestBody OpenRequest request) {
        if (request == null || request.sellerId() == null) {
            return ApiResponse.error(400, "请选择要洽谈的供应商");
        }
        Long userId = currentUserId();
        TradeProduct shopProduct = requireSeller(request.sellerId());
        TradeProduct product = request.productId() == null ? shopProduct : productMapper.selectById(request.productId());
        if (product == null || !request.sellerId().equals(product.getSellerId())
                || !"published".equals(product.getPublishStatus())) {
            return ApiResponse.error(400, "商品不属于该店铺或已下架");
        }
        Negotiation negotiation = negotiationMapper.selectOne(new LambdaQueryWrapper<Negotiation>()
                .eq(Negotiation::getBuyerUserId, userId)
                .eq(Negotiation::getSellerId, request.sellerId())
                .last("LIMIT 1"));
        LoginUser user = SecurityUtils.getLoginUser();
        String buyerName = displayName(user);
        if (negotiation == null) {
            negotiation = new Negotiation();
            negotiation.setConversationNo("NC" + System.currentTimeMillis()
                    + String.format("%03d", ThreadLocalRandom.current().nextInt(1000)));
            negotiation.setBuyerUserId(userId);
            negotiation.setBuyerName(buyerName);
            negotiation.setSellerId(request.sellerId());
            negotiation.setSellerName(firstNonBlank(shopProduct.getSellerName(), "供应商"));
            negotiation.setProductId(product.getId());
            negotiation.setProductName(product.getProductName());
            negotiation.setBuyerUnread(0);
            negotiation.setSellerUnread(0);
            negotiation.setStatus(1);
            negotiation.setCreateTime(LocalDateTime.now());
            negotiation.setUpdateTime(LocalDateTime.now());
            negotiationMapper.insert(negotiation);
        } else if (request.productId() != null) {
            negotiation.setProductId(product.getId());
            negotiation.setProductName(product.getProductName());
            negotiation.setUpdateTime(LocalDateTime.now());
            negotiationMapper.updateById(negotiation);
        }
        return ApiResponse.success(conversationView(negotiation, List.of(request.sellerId())));
    }

    @GetMapping("/negotiations")
    public ApiResponse<List<ConversationView>> conversations() {
        Long userId = currentUserId();
        List<Long> sellerIds = identityService.currentScope().merchantIds();
        LambdaQueryWrapper<Negotiation> wrapper = new LambdaQueryWrapper<>();
        if (sellerIds.isEmpty()) {
            wrapper.eq(Negotiation::getBuyerUserId, userId);
        } else {
            wrapper.and(query -> query.eq(Negotiation::getBuyerUserId, userId)
                    .or().in(Negotiation::getSellerId, sellerIds));
        }
        wrapper.eq(Negotiation::getStatus, 1)
                .orderByDesc(Negotiation::getLastMessageTime)
                .orderByDesc(Negotiation::getCreateTime);
        return ApiResponse.success(negotiationMapper.selectList(wrapper).stream()
                .map(item -> conversationView(item, sellerIds))
                .collect(Collectors.toList()));
    }

    @GetMapping("/negotiations/{id}/messages")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<List<MessageView>> messages(@PathVariable Long id) {
        Long userId = currentUserId();
        List<Long> sellerIds = identityService.currentScope().merchantIds();
        Negotiation negotiation = requireConversation(id, userId, sellerIds);
        if (userId.equals(negotiation.getBuyerUserId())) {
            negotiation.setBuyerUnread(0);
        } else {
            negotiation.setSellerUnread(0);
        }
        negotiationMapper.updateById(negotiation);
        List<NegotiationMessage> messages = messageMapper.selectList(
                new LambdaQueryWrapper<NegotiationMessage>()
                        .eq(NegotiationMessage::getNegotiationId, id)
                        .orderByAsc(NegotiationMessage::getCreateTime)
                        .orderByAsc(NegotiationMessage::getId));
        return ApiResponse.success(messages.stream()
                .map(item -> messageView(item, userId))
                .collect(Collectors.toList()));
    }

    @PostMapping("/negotiations/{id}/messages")
    @Transactional(rollbackFor = Exception.class)
    public ApiResponse<MessageView> send(@PathVariable Long id, @RequestBody SendRequest request) {
        Long userId = currentUserId();
        List<Long> sellerIds = identityService.currentScope().merchantIds();
        Negotiation negotiation = requireConversation(id, userId, sellerIds);
        if (request == null) {
            return ApiResponse.error(400, "消息内容不能为空");
        }
        String content = request == null || request.content() == null ? "" : request.content().trim();
        String type = request.messageType() == null ? "TEXT" : request.messageType().trim().toUpperCase();
        if (!List.of("TEXT", "QUOTE", "ORDER_REQUEST").contains(type)) {
            return ApiResponse.error(400, "不支持的消息类型");
        }
        boolean buyer = userId.equals(negotiation.getBuyerUserId());
        LocalDateTime now = LocalDateTime.now();
        NegotiationMessage message = new NegotiationMessage();
        message.setNegotiationId(id);
        message.setSenderUserId(userId);
        message.setSenderRole(buyer ? "BUYER" : "SELLER");
        message.setSenderName(buyer ? negotiation.getBuyerName() : negotiation.getSellerName());
        message.setMessageType(type);
        if ("ORDER_REQUEST".equals(type)) {
            if (!buyer) {
                return ApiResponse.error(400, "只有采购方可以发布采购需求");
            }
            if (request.businessId() == null || request.quantity() == null || request.quantity().signum() <= 0) {
                return ApiResponse.error(400, "采购需求必须指定商品和大于 0 的数量");
            }
            TradeProduct product = productMapper.selectById(request.businessId());
            if (product == null || !Integer.valueOf(0).equals(product.getDelFlag())
                    || !"published".equals(product.getPublishStatus())
                    || !negotiation.getSellerId().equals(product.getSellerId())) {
                return ApiResponse.error(400, "洽谈商品不存在、已下架或不属于当前供应商");
            }
            String unit = request.unit() == null || request.unit().isBlank()
                    ? product.getUnit() : request.unit().trim();
            BigDecimal price = request.price();
            String priceText = price == null ? "价格面议" : "期望价 ¥" + price.stripTrailingZeros().toPlainString() + "/" + unit;
            content = "采购需求：" + product.getProductName() + "，" + request.quantity().stripTrailingZeros().toPlainString()
                    + unit + "，" + priceText;
            message.setBusinessType("ORDER_REQUEST");
            message.setBusinessId(product.getId());
            message.setBusinessTitle(product.getProductName());
            message.setBusinessUrl("/order/create?productId=" + product.getId()
                    + "&quantity=" + request.quantity().stripTrailingZeros().toPlainString());
            message.setBusinessQuantity(request.quantity());
            message.setBusinessUnit(unit);
            message.setBusinessPrice(price);
        }
        if (content.isEmpty()) {
            return ApiResponse.error(400, "消息内容不能为空");
        }
        if (content.length() > 1000) {
            return ApiResponse.error(400, "单条消息不能超过 1000 个字符");
        }
        message.setContent(content);
        message.setReadFlag(0);
        message.setCreateTime(now);
        messageMapper.insert(message);

        negotiation.setLastMessage(content.length() > 180 ? content.substring(0, 180) + "…" : content);
        negotiation.setLastMessageTime(now);
        negotiation.setUpdateTime(now);
        if (buyer) {
            negotiation.setSellerUnread((negotiation.getSellerUnread() == null ? 0 : negotiation.getSellerUnread()) + 1);
        } else {
            negotiation.setBuyerUnread((negotiation.getBuyerUnread() == null ? 0 : negotiation.getBuyerUnread()) + 1);
        }
        negotiationMapper.updateById(negotiation);
        return ApiResponse.success(messageView(message, userId));
    }

    private TradeProduct requireSeller(Long sellerId) {
        TradeProduct product = productMapper.selectOne(new LambdaQueryWrapper<TradeProduct>()
                .eq(TradeProduct::getDelFlag, 0)
                .eq(TradeProduct::getPublishStatus, "published")
                .eq(TradeProduct::getSellerId, sellerId)
                .orderByDesc(TradeProduct::getCreateTime)
                .last("LIMIT 1"));
        if (product == null) {
            throw new IllegalArgumentException("供应商不存在或暂无在售货源");
        }
        return product;
    }

    private Negotiation requireConversation(Long id, Long userId, List<Long> sellerIds) {
        Negotiation negotiation = negotiationMapper.selectById(id);
        if (negotiation == null || !Integer.valueOf(1).equals(negotiation.getStatus())) {
            throw new IllegalArgumentException("洽谈会话不存在或已关闭");
        }
        if (!userId.equals(negotiation.getBuyerUserId()) && !sellerIds.contains(negotiation.getSellerId())) {
            throw new IllegalArgumentException("无权访问该洽谈会话");
        }
        return negotiation;
    }

    private ConversationView conversationView(Negotiation negotiation, List<Long> sellerIds) {
        Long userId = currentUserId();
        boolean seller = !userId.equals(negotiation.getBuyerUserId())
                && sellerIds.contains(negotiation.getSellerId());
        String peer = seller ? negotiation.getBuyerName() : negotiation.getSellerName();
        int unread = seller
                ? (negotiation.getSellerUnread() == null ? 0 : negotiation.getSellerUnread())
                : (negotiation.getBuyerUnread() == null ? 0 : negotiation.getBuyerUnread());
        return new ConversationView(
                negotiation.getId(),
                negotiation.getConversationNo(),
                peer,
                seller ? "SELLER" : "BUYER",
                negotiation.getProductId(),
                negotiation.getProductName(),
                negotiation.getLastMessage(),
                negotiation.getLastMessageTime(),
                unread,
                negotiation.getSellerId(),
                negotiation.getSellerName());
    }

    private Long currentUserId() {
        Long userId = SecurityUtils.getUserId();
        if (userId == null) {
            throw new IllegalStateException("登录状态已失效");
        }
        return userId;
    }

    private static String displayName(LoginUser user) {
        if (user == null) return "平台用户";
        return firstNonBlank(user.getNickname(), user.getUsername(), "平台用户");
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "";
    }

    private static MessageView messageView(NegotiationMessage message, Long userId) {
        return new MessageView(message.getId(), userId.equals(message.getSenderUserId()),
                message.getSenderRole(), message.getSenderName(), message.getMessageType(),
                message.getContent(), message.getAttachmentUrl(),
                message.getBusinessType(), message.getBusinessId(), message.getBusinessTitle(),
                message.getBusinessUrl(), message.getBusinessQuantity(),
                message.getBusinessUnit(), message.getBusinessPrice(), message.getCreateTime());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(IllegalArgumentException exception) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(400, exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleUnauthorized(IllegalStateException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(401, exception.getMessage()));
    }

    public record FollowState(boolean followed, long followers) {
    }

    public record FavoriteState(boolean favorited) {
    }

    public record FavoriteProductView(
            Long productId,
            String productName,
            Long sellerId,
            String sellerName,
            String categoryName,
            BigDecimal price,
            String unit,
            String publishStatus,
            LocalDateTime favoritedAt) {
    }

    public record FollowingSellerView(
            Long sellerId,
            String sellerName,
            String province,
            String city,
            int productCount,
            BigDecimal minPrice,
            String categories,
            LocalDateTime followedAt) {
    }

    public record OpenRequest(Long sellerId, Long productId) {
    }

    public record SendRequest(
            String content,
            String messageType,
            Long businessId,
            BigDecimal quantity,
            String unit,
            BigDecimal price) {
    }

    public record ConversationView(
            Long id,
            String conversationNo,
            String peerName,
            String role,
            Long productId,
            String productName,
            String lastMessage,
            LocalDateTime lastMessageTime,
            int unread,
            Long sellerId,
            String sellerName) {
    }

    public record MessageView(
            Long id,
            boolean mine,
            String senderRole,
            String senderName,
            String messageType,
            String content,
            String attachmentUrl,
            String businessType,
            Long businessId,
            String businessTitle,
            String businessUrl,
            BigDecimal businessQuantity,
            String businessUnit,
            BigDecimal businessPrice,
            LocalDateTime createTime) {
    }
}
