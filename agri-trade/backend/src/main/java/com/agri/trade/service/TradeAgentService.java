package com.agri.trade.service;

import com.agri.trade.common.security.SecurityUtils;
import com.agri.trade.entity.*;
import com.agri.trade.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;

/** 双边委托与协商编排。报价/订单/合同和履约事实仍由原交易业务拥有。 */
@Service
@RequiredArgsConstructor
public class TradeAgentService {
    private final JdbcTemplate db;
    private final ObjectMapper json;
    private final PlatformIdentityService identity;
    private final DemandMapper demands;
    private final TradeProductMapper products;
    private final TradeOrderMapper orders;
    private final LogisticsMapper logistics;
    private final ContractMapper contracts;
    private final IInquiryService inquiries;
    private final IQuoteService quotes;

    private List<Long> scope() {
        var s=identity.currentScope();
        require(s.resolved() && s.hasBinding(),"未绑定经营主体或身份服务不可用");
        return s.merchantIds();
    }
    private String actor() { require(SecurityUtils.getUserId()!=null,"请先登录"); return String.valueOf(SecurityUtils.getUserId()); }
    private static void require(boolean ok,String message) { if(!ok) throw new IllegalArgumentException(message); }
    private static LocalDateTime datetime(Object value) {
        if(value instanceof LocalDateTime v)return v;
        if(value instanceof Timestamp v)return v.toLocalDateTime();
        throw new IllegalArgumentException("数据库时间字段无效");
    }
    private static LocalDate date(Object value) {
        if(value instanceof LocalDate v)return v;
        if(value instanceof java.sql.Date v)return v.toLocalDate();
        try{return LocalDate.parse(text(value));}catch(Exception e){throw new IllegalArgumentException("请填写有效日期");}
    }
    private static long lng(Object v) { return Long.parseLong(String.valueOf(v)); }
    private static BigDecimal num(Object v) { try { return new BigDecimal(String.valueOf(v)); } catch(Exception e){throw new IllegalArgumentException("请填写有效数值");} }
    private static BigDecimal dec(Map<String,Object> m,String key) { return num(m.get(key)); }
    private static String text(Object v) { return v==null?"":String.valueOf(v).trim(); }
    private static String role(String value) { require(Set.of("BUYER","SELLER").contains(value),"无效Agent角色"); return value; }
    private String encode(Object v) { try{return json.writeValueAsString(v);}catch(Exception e){throw new IllegalStateException("快照保存失败",e);} }
    private Map<String,Object> one(String sql,Object...args) { var list=db.queryForList(sql,args); require(!list.isEmpty(),"记录不存在或不可访问"); return list.get(0); }
    private Map<String,Object> mandate(String id,boolean lock) { return one("SELECT * FROM agri_trade_agent_mandate WHERE id=?"+(lock?" FOR UPDATE":""),id); }
    private boolean active(Map<String,Object> m) { return "ACTIVE".equals(m.get("status")) && datetime(m.get("expires_at")).isAfter(LocalDateTime.now()); }
    private void owner(Map<String,Object> m) { require(scope().contains(lng(m.get("merchant_id"))),"无权操作该委托"); }
    private Demand demand(long id) { var d=demands.selectById(id); require(d!=null && Integer.valueOf(0).equals(d.getDelFlag()),"采购需求已删除或不存在"); require(!Set.of("completed","closed").contains(text(d.getDemandStatus())),"采购需求已关闭或成交"); require(d.getValidUntil()==null || d.getValidUntil().after(new Date()),"采购需求已过期"); return d; }
    private TradeProduct product(long id) { var p=products.selectById(id); require(p!=null && Integer.valueOf(0).equals(p.getDelFlag()) && "published".equals(p.getPublishStatus()),"货源未上架或不存在"); require(p.getValidUntil()==null || p.getValidUntil().after(new Date()),"货源已过期"); return p; }
    private Map<String,Object> snapshot(Demand d, TradeProduct p) {
        var v=new LinkedHashMap<String,Object>();
        v.put("demandId",d.getId());v.put("buyerId",d.getBuyerId());v.put("buyerName",d.getBuyerName());
        v.put("productId",p.getId());v.put("sellerId",p.getSellerId());v.put("sellerName",p.getSellerName());
        v.put("productName",p.getProductName());v.put("categoryId",p.getCategoryId());v.put("variety",p.getVariety());
        v.put("unit",p.getUnit());v.put("qualityLevel",p.getQualityLevel());v.put("specSize",p.getSpecSize());v.put("specLevel",p.getSpecLevel());
        v.put("requiredVariety",d.getVariety());v.put("requiredQuality",d.getQualityLevel());v.put("requiredSpec",d.getSpecDesc());
        v.put("requiredQuantity",quantity(d).stripTrailingZeros().toPlainString());v.put("deliveryAddress",d.getDeliveryAddress());v.put("deliveryDeadline",d.getDeliveryDeadline());
        v.put("qualityRequirement",d.getQualityRequirement());v.put("packagingRequire",d.getPackagingRequire());v.put("additionalRequirements",d.getAdditionalRequirements());
        v.put("policyVersion",TradeAgentPolicy.VERSION);v.put("terms","人民币，同单位单价；运费另计；双方确认后转待确认订单，不自动付款/签约/发货");return v;
    }
    private BigDecimal quantity(Demand d) { return d.getQuantity()!=null?d.getQuantity():d.getDemandQuantity(); }
    private void compatible(Demand d,TradeProduct p,BigDecimal qty) {
        require(d.getBuyerId()!=null && p.getSellerId()!=null && !d.getBuyerId().equals(p.getSellerId()),"不可与本主体自成交");
        require(d.getCategoryId()!=null && d.getCategoryId().equals(p.getCategoryId()),"品类不一致或未维护品类");
        require(text(d.getProductName()).isEmpty() || text(d.getProductName()).equals(text(p.getProductName())),"产品名称不一致，请先人工核验商品等价关系");
        require(TradeAgentPolicy.compatible(d.getUnit(),p.getUnit(),d.getVariety(),p.getVariety(),d.getQualityLevel(),p.getQualityLevel()),"单位、品种或质量等级不一致，须人工澄清后再委托");
        require(text(d.getSpecDesc()).isEmpty() || text(d.getSpecDesc()).equals(text(p.getSpecSize())) || text(d.getSpecDesc()).equals(text(p.getSpecLevel())),"规格不一致，暂不自动协商");
        require(qty!=null && qty.signum()>0 && qty.compareTo(quantity(d))==0,"需求数量变化，请重新委托");
        require(p.getStockQuantity()!=null && p.getStockQuantity().compareTo(qty)>=0,"库存不足");
        require(p.getMinOrderQuantity()==null || p.getMinOrderQuantity().compareTo(qty)<=0,"未达到起订量");
        require(text(d.getQualityRequirement()).isEmpty() && text(d.getPackagingRequire()).isEmpty() && text(d.getAdditionalRequirements()).isEmpty() && (d.getSampleRequire()==null || d.getSampleRequire()==0),"需求含专项质量、包装、样品或附加条款，请先人工澄清");
        require(text(p.getSourceOfferNo()).isEmpty(),"产销对接承接货源请使用原产销履约流程，暂不自动协商");
        require(db.queryForObject("SELECT COUNT(*) FROM agri_trade_product_sku WHERE product_id=? AND del_flag=0",Integer.class,p.getId())==0,"多规格货源请使用原SKU询报价流程，暂不自动协商");
        require(text(d.getCertificationRequire()).isEmpty(),"需求含专项认证要求，请先走人工询报价核验");
    }
    public Map<String,Object> workspace(String r) {
        role(r); var ids=scope(); var result=new LinkedHashMap<String,Object>();
        result.put("mandates", db.queryForList("SELECT * FROM agri_trade_agent_mandate WHERE role=? AND merchant_id IN ("+marks(ids.size())+") ORDER BY created_at DESC LIMIT 100",args(r,ids)));
        if("BUYER".equals(r)) result.put("references",demands.selectList(new LambdaQueryWrapper<Demand>().in(Demand::getBuyerId,ids).eq(Demand::getDelFlag,0).orderByDesc(Demand::getCreateTime).last("LIMIT 100")));
        else result.put("references",products.selectList(new LambdaQueryWrapper<TradeProduct>().in(TradeProduct::getSellerId,ids).eq(TradeProduct::getDelFlag,0).orderByDesc(TradeProduct::getCreateTime).last("LIMIT 100")));
        result.put("sessions",sessions(r)); result.put("policyVersion",TradeAgentPolicy.VERSION); return result;
    }
    private static String marks(int count) { return String.join(",",Collections.nCopies(count,"?")); }
    private static Object[] args(Object first,List<Long> ids) { var a=new ArrayList<Object>();a.add(first);a.addAll(ids);return a.toArray(); }
    private List<Map<String,Object>> sessions(String r) {
        var ids=scope(); return db.queryForList("SELECT s.id,s.buyer_id,s.seller_id,s.demand_id,s.product_id,s.quantity,s.unit,s.agreed_price,s.freight,s.delivery_date,CASE WHEN s.status='AWAITING_CONFIRMATION' AND (s.expires_at<=NOW() OR s.delivery_date<CURDATE() OR b.status<>'ACTIVE' OR sm.status<>'ACTIVE') THEN 'EXPIRED' ELSE s.status END status,s.revision,s.buyer_confirmed,s.seller_confirmed,s.quote_id,s.order_id,s.public_snapshot,s.expires_at,s.created_at,s.updated_at FROM agri_trade_agent_session s JOIN agri_trade_agent_mandate b ON b.id=s.buyer_mandate_id JOIN agri_trade_agent_mandate sm ON sm.id=s.seller_mandate_id WHERE s."+("BUYER".equals(r)?"buyer_id":"seller_id")+" IN ("+marks(ids.size())+") ORDER BY s.created_at DESC LIMIT 100",ids.toArray());
    }
    @Transactional
    public Map<String,Object> create(Map<String,Object> input) {
        var ids=scope(); String r=role(text(input.get("role"))); long ref=lng(input.get("refId")); Long merchant;
        BigDecimal qty;
        if("BUYER".equals(r)) { var d=demand(ref); merchant=d.getBuyerId(); qty=quantity(d); }
        else { var p=product(ref); merchant=p.getSellerId(); qty=num(input.get("quantity")); }
        require(ids.contains(merchant),"只能委托自己的需求或货源");
        require(qty!=null && qty.signum()>0,"委托数量必须大于0");
        BigDecimal target=num(input.get("targetPrice")), limit=num(input.get("limitPrice")), freight=num(input.getOrDefault("freight",0));
        require(target.signum()>0 && limit.signum()>0 && freight.signum()>=0,"价格必须大于0且运费非负");
        require(target.scale()<=4 && limit.scale()<=4 && qty.scale()<=4 && freight.scale()<=2,"单价/数量最多4位小数，运费最多2位小数");
        require(target.compareTo(new BigDecimal("100000000"))<0 && limit.compareTo(new BigDecimal("100000000"))<0 && qty.compareTo(new BigDecimal("100000000"))<0 && freight.compareTo(new BigDecimal("100000000"))<0,"数值超出范围");
        require("BUYER".equals(r)?target.compareTo(limit)<=0:target.compareTo(limit)>=0,"买方目标价不能高于上限，卖方目标价不能低于底价");
        int rounds=Integer.parseInt(text(input.getOrDefault("maxRounds",5))); require(rounds>=1 && rounds<=10,"轮次必须为1至10");
        LocalDate date=date(input.get("deliveryDate")); require(!date.isBefore(LocalDate.now()) && !date.isAfter(LocalDate.now().plusDays(90)),"交付日须在未来90天内");
        if("BUYER".equals(r)) { var d=demand(ref); require(d.getDeliveryDeadline()==null || !date.isAfter(d.getDeliveryDeadline().toInstant().atZone(ZoneId.systemDefault()).toLocalDate()),"交付日超过采购截止日期"); require(!text(d.getDeliveryAddress()).isEmpty(),"请先在采购需求中补齐交付地址"); }
        else require(product(ref).getStockQuantity()!=null && qty.compareTo(product(ref).getStockQuantity())<=0,"委托供货数量超过当前库存");
        // 锁业务主表，同一需求/货源创建委托串行化；旧协商必须重新获得双方确认。
        String table="BUYER".equals(r)?"agri_trade_demand":"agri_trade_product";
        db.queryForList("SELECT id FROM "+table+" WHERE id=? FOR UPDATE",ref);
        db.update("UPDATE agri_trade_agent_mandate SET status='REVOKED' WHERE role=? AND ref_id=? AND merchant_id=? AND status='ACTIVE'",r,ref,merchant);
        String id=UUID.randomUUID().toString();
        db.update("INSERT INTO agri_trade_agent_mandate(id,role,merchant_id,ref_id,target_price,limit_price,quantity,freight,max_rounds,delivery_date,expires_at,status,policy_version,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,NOW())",id,r,merchant,ref,target,limit,qty,freight,rounds,date,Timestamp.valueOf(LocalDateTime.now().plusDays(3)),TradeAgentPolicy.VERSION,actor());
        // 双方已有委托时自动推进协商，不需要人工逐次报价。
        if("BUYER".equals(r)) runInternal(mandate(id,false));
        else {
            var buyers=db.queryForList("SELECT * FROM agri_trade_agent_mandate WHERE role='BUYER' AND status='ACTIVE' AND expires_at>NOW() ORDER BY created_at DESC LIMIT 100");
            for(var b:buyers) pairIfCompatible(b,mandate(id,false));
        }
        return mandate(id,false);
    }
    @Transactional
    public void revoke(String id) { var m=mandate(id,true);owner(m);db.update("UPDATE agri_trade_agent_mandate SET status='REVOKED' WHERE id=?",id); }
    @Transactional
    public List<Map<String,Object>> run(String id) { var m=mandate(id,true);owner(m);require("BUYER".equals(m.get("role")),"仅采购Agent发起比价");require(active(m),"委托已过期或撤销");runInternal(m);return compare(id); }
    private void runInternal(Map<String,Object> buyer) {
        var sellers=db.queryForList("SELECT * FROM agri_trade_agent_mandate WHERE role='SELLER' AND status='ACTIVE' AND expires_at>NOW() ORDER BY created_at DESC LIMIT 100");
        for(var seller:sellers) pairIfCompatible(buyer,seller);
    }
    private void pairIfCompatible(Map<String,Object> b,Map<String,Object> s) {
        if(!active(b)||!active(s))return;
        Demand d; TradeProduct p;
        try { d=demand(lng(b.get("ref_id")));p=product(lng(s.get("ref_id"))); compatible(d,p,dec(b,"quantity"));
            require(lng(b.get("merchant_id"))==d.getBuyerId() && lng(s.get("merchant_id"))==p.getSellerId(),"归属已变化");
            require(dec(s,"quantity").compareTo(dec(b,"quantity"))>=0,"供货委托数量不足");
            require(!date(s.get("delivery_date")).isAfter(date(b.get("delivery_date"))),"供货交期晚于要求");
        } catch(IllegalArgumentException e){return;}
        var policy=TradeAgentPolicy.negotiate(dec(b,"target_price"),dec(b,"limit_price"),dec(s,"target_price"),dec(s,"limit_price"),Math.min(((Number)b.get("max_rounds")).intValue(),((Number)s.get("max_rounds")).intValue()));
        String id=UUID.randomUUID().toString();
        String snapshot=encode(snapshot(d,p));
        LocalDateTime expires=datetime(b.get("expires_at")).isBefore(datetime(s.get("expires_at")))?datetime(b.get("expires_at")):datetime(s.get("expires_at"));
        int inserted=db.update("INSERT IGNORE INTO agri_trade_agent_session(id,buyer_mandate_id,seller_mandate_id,buyer_id,seller_id,demand_id,product_id,quantity,unit,agreed_price,freight,delivery_date,status,revision,public_snapshot,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,NOW(),NOW())",id,b.get("id"),s.get("id"),d.getBuyerId(),p.getSellerId(),d.getId(),p.getId(),b.get("quantity"),d.getUnit(),policy.price(),s.get("freight"),b.get("delivery_date"),policy.price()==null?"NO_AGREEMENT":"AWAITING_CONFIRMATION",snapshot,expires);
        if(inserted>0) { for(var round:policy.rounds())event(id,"NEGOTIATION_ROUND","AGENTS",round); event(id,policy.price()==null?"NO_AGREEMENT":"PROPOSAL_READY","AGENTS",Map.of("policyVersion",TradeAgentPolicy.VERSION)); }
    }
    public List<Map<String,Object>> compare(String id) {
        var b=mandate(id,false); owner(b); require("BUYER".equals(b.get("role")),"仅买方可比价");
        // 不返回对方委托、底价、内部策略。比价含运费，但不声称运距或质量已自动验真。
        return db.queryForList("SELECT s.id,s.product_id,p.product_name,p.seller_name,p.quality_level,s.quantity,s.unit,s.agreed_price,s.freight,(ROUND(s.agreed_price*s.quantity,2)+s.freight) total_amount,s.delivery_date,s.status,s.expires_at FROM agri_trade_agent_session s JOIN agri_trade_product p ON p.id=s.product_id WHERE s.buyer_mandate_id=? ORDER BY s.agreed_price IS NULL,total_amount,s.id",id);
    }
    public Map<String,Object> detail(String id) {
        var s=visible(id,false); var result=new LinkedHashMap<>(s); result.remove("buyer_mandate_id"); result.remove("seller_mandate_id");
        result.put("events",db.queryForList("SELECT event_type,actor,detail_json,created_at FROM agri_trade_agent_event WHERE session_id=? ORDER BY id",id));
        result.put("effective",effective(s));
        if(s.get("order_id")!=null) {
            var order=orders.selectById(lng(s.get("order_id")));result.put("order",order);
            result.put("logistics",logistics.selectList(new LambdaQueryWrapper<Logistics>().eq(Logistics::getOrderId,lng(s.get("order_id"))).eq(Logistics::getDelFlag,0)));
            result.put("contracts",contracts.selectList(new LambdaQueryWrapper<Contract>().eq(Contract::getOrderId,lng(s.get("order_id"))).eq(Contract::getDelFlag,0)));
            result.put("fulfillmentWarnings", order!=null && order.getDeliveryDeadline()!=null && order.getDeliveryDeadline().before(new Date()) && !Set.of("received","completed","cancelled","refunded","closed").contains(text(order.getOrderStatus())) ? List.of("已超过约定交付日，请在原订单或售后流程跟进") : List.of());
            result.put("trackingNote", "履约以原订单、合同和物流台账为准；Agent不代付款、发货或确认收货");
        }
        return result;
    }
    private Map<String,Object> visible(String id,boolean lock) { var s=one("SELECT * FROM agri_trade_agent_session WHERE id=?"+(lock?" FOR UPDATE":""),id);var ids=scope();require(ids.contains(lng(s.get("buyer_id")))||ids.contains(lng(s.get("seller_id"))),"无权查看该协商");return s; }
    private boolean effective(Map<String,Object> s) { return !date(s.get("delivery_date")).isBefore(LocalDate.now()) && datetime(s.get("expires_at")).isAfter(LocalDateTime.now()) && active(mandate(text(s.get("buyer_mandate_id")),false)) && active(mandate(text(s.get("seller_mandate_id")),false)); }
    @Transactional
    public Map<String,Object> confirm(String id,String r,int revision) {
        role(r); var s=visible(id,true); require(scope().contains(lng(s.get("BUYER".equals(r)?"buyer_id":"seller_id"))),"只能确认本方方案");
        require(((Number)s.get("revision")).intValue()==revision,"方案版本不一致，请重新查看");
        if("ORDERED".equals(s.get("status")))return detail(id);
        require(!date(s.get("delivery_date")).isBefore(LocalDate.now()),"交付日期已过，请重新协商");
        require("AWAITING_CONFIRMATION".equals(s.get("status")) && effective(s),"方案已失效、被撤销或未达成一致");
        var b=mandate(text(s.get("buyer_mandate_id")),true); var sm=mandate(text(s.get("seller_mandate_id")),true);
        require(active(b)&&active(sm),"双方委托必须保持有效");
        String who=actor(); String opposite="BUYER".equals(r)?"SELLER_CONFIRMED":"BUYER_CONFIRMED";
        require(db.queryForObject("SELECT COUNT(*) FROM agri_trade_agent_event WHERE session_id=? AND event_type=? AND actor=?",Integer.class,id,opposite,who)==0,"双方最终确认须由不同操作账号完成");
        String col="BUYER".equals(r)?"buyer_confirmed":"seller_confirmed";
        if(((Number)s.get(col)).intValue()==0) { db.update("UPDATE agri_trade_agent_session SET "+col+"=1,updated_at=NOW() WHERE id=?",id);event(id,r+"_CONFIRMED",who,Map.of("revision",revision,"price",s.get("agreed_price"),"quantity",s.get("quantity"),"freight",s.get("freight"))); }
        s=visible(id,true);
        if(((Number)s.get("buyer_confirmed")).intValue()==1 && ((Number)s.get("seller_confirmed")).intValue()==1) convert(s,b,sm);
        return detail(id);
    }
    private void convert(Map<String,Object> s,Map<String,Object> b,Map<String,Object> sm) {
        long demandId=lng(s.get("demand_id")), productId=lng(s.get("product_id"));
        db.queryForList("SELECT id FROM agri_trade_demand WHERE id=? FOR UPDATE",demandId);
        db.queryForList("SELECT id FROM agri_trade_product WHERE id=? FOR UPDATE",productId);
        var d=demand(demandId);var p=product(productId); BigDecimal qty=dec(s,"quantity"); compatible(d,p,qty);
        require(d.getBuyerId().equals(lng(s.get("buyer_id"))) && p.getSellerId().equals(lng(s.get("seller_id"))),"交易归属变化");
        require(encode(snapshot(d,p)).equals(text(s.get("public_snapshot"))),"原需求或货源已变更，请重新委托协商");
        require(dec(sm,"quantity").compareTo(qty)>=0,"卖方授权余量不足，请重新协商");
        require(dec(s,"agreed_price").compareTo(dec(b,"limit_price"))<=0 && dec(s,"agreed_price").compareTo(dec(sm,"limit_price"))>=0,"超出授权边界");
        require(db.queryForObject("SELECT COUNT(*) FROM agri_trade_order WHERE demand_id=? AND del_flag=0 AND order_status NOT IN ('cancelled','closed','refunded')",Integer.class,demandId)==0,"该需求已有有效订单，请先处理原订单");
        var existing=inquiries.getInquiriesByScope(List.of(d.getBuyerId())).stream().filter(i->Objects.equals(i.getDemandId(),demandId)&&Objects.equals(i.getProductId(),productId)).findFirst();
        Inquiry in=existing.orElseGet(()->inquiries.createInquiry(demandId,productId,List.of(d.getBuyerId())));
        require(in!=null,"无法建立询价关联");
        // 原询价生成器只取quantity；兼容历史需求的demandQuantity字段。
        db.update("UPDATE agri_trade_inquiry SET quantity=?,unit=? WHERE id=?",qty,d.getUnit(),in.getId());
        Quote quote=quotes.createQuote(in.getId(),dec(s,"agreed_price"),qty,dec(s,"freight"),"双方Agent方案最终确认："+s.get("id"));
        require(quote!=null,"报价生成失败");
        quote.setDeliveryDeadline(java.sql.Date.valueOf(date(s.get("delivery_date"))));quote.setDeliveryAddress(d.getDeliveryAddress());quotes.updateById(quote);
        TradeOrder order=quotes.convertToOrder(quote.getId());require(order!=null,"订单生成失败");
        order.setSource("agent");orders.updateById(order);
        int updated=db.update("UPDATE agri_trade_product SET stock_quantity=stock_quantity-? WHERE id=? AND stock_quantity>=?",qty,productId,qty);require(updated==1,"库存变化，请重新协商");
        db.update("UPDATE agri_trade_inquiry SET order_id=?,inquiry_status='converted',convert_time=NOW(),update_time=NOW() WHERE id=?",order.getId(),in.getId());
        db.update("UPDATE agri_trade_agent_session SET status='ORDERED',quote_id=?,order_id=?,updated_at=NOW() WHERE id=?",quote.getId(),order.getId(),s.get("id"));
        db.update("UPDATE agri_trade_agent_mandate SET status='COMPLETED' WHERE id=?",b.get("id"));
        db.update("UPDATE agri_trade_agent_mandate SET status=CASE WHEN quantity-?<=0 THEN 'COMPLETED' ELSE status END,quantity=quantity-? WHERE id=?",qty,qty,sm.get("id"));
        event(text(s.get("id")),"ORDER_LINKED",actor(),Map.of("quoteId",quote.getId(),"orderId",order.getId(),"orderNo",order.getOrderNo()));
    }
    @Transactional
    public void reject(String id,String reason) {var s=visible(id,true);require("AWAITING_CONFIRMATION".equals(s.get("status")),"仅可拒绝待确认方案");require(!reason.isBlank()&&reason.length()<=500,"请填写500字以内拒绝原因");db.update("UPDATE agri_trade_agent_session SET status='REJECTED',updated_at=NOW() WHERE id=?",id);event(id,"REJECTED",actor(),Map.of("reason",reason));}
    private void event(String id,String type,String user,Object detail){db.update("INSERT INTO agri_trade_agent_event(session_id,event_type,actor,detail_json,created_at) VALUES(?,?,?,?,NOW())",id,type,user,encode(detail));}
}
