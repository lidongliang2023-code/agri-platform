package com.agri.trade.service.impl;

import com.agri.trade.entity.Demand;
import com.agri.trade.service.INlpParseService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Date;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class NlpParseServiceImpl implements INlpParseService {

    private static final Pattern PRODUCT_PATTERN = Pattern.compile("(玉米|小麦|水稻|大豆|棉花|蔬菜|水果|猪肉|牛肉|鸡蛋|牛奶|化肥|农药|种子|饲料)", Pattern.CASE_INSENSITIVE);
    private static final Pattern QUANTITY_PATTERN = Pattern.compile("(\\d+(\\.\\d+)?)(\\s*)(吨|公斤|千克|斤|箱|袋|件|亩|公顷|头|只|个)");
    private static final Pattern PRICE_PATTERN = Pattern.compile("(\\d+(\\.\\d+)?)(\\s*)(元|块|钱|$/|¥)");
    private static final Pattern LOCATION_PATTERN = Pattern.compile("(北京|天津|河北|山西|内蒙古|辽宁|吉林|黑龙江|上海|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|广西|海南|重庆|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆|香港|澳门|台湾|省|市|区|县|镇|村)");
    private static final Pattern TIME_PATTERN = Pattern.compile("(今天|明天|后天|本周|下周|本月|下月|今年|明年|\\d+天内|\\d+周内|\\d+月内|\\d+号|\\d+月\\d+日)");
    private static final Pattern QUALITY_PATTERN = Pattern.compile("(优质|一等|二等|三等|绿色|有机|无公害|新鲜|优良|精品|特级|一级|二级)");

    @Override
    public Demand parseNaturalLanguage(String naturalText, Long userId) {
        INlpParseService.ParsedDemandResult result = parseAndExtract(naturalText);

        Demand demand = new Demand();
        demand.setDemandName(result.getProductName() != null ? result.getProductName() : "采购需求");
        demand.setCategoryCode(getCategoryCode(result.getProductName()));
        demand.setProductName(result.getProductName());
        demand.setSpecDesc(result.getQuality() != null ? result.getQuality() : "");
        demand.setQualityLevel(result.getQuality() != null ? result.getQuality() : "normal");
        
        if (result.getQuantity() != null) {
            try {
                demand.setDemandQuantity(new BigDecimal(result.getQuantity()));
            } catch (Exception e) {
                demand.setDemandQuantity(BigDecimal.ZERO);
            }
        }
        demand.setUnit(result.getUnit() != null ? result.getUnit() : "公斤");
        
        if (result.getPrice() != null) {
            try {
                demand.setExpectedPrice(new BigDecimal(result.getPrice()));
            } catch (Exception e) {
                demand.setExpectedPrice(null);
            }
        }
        
        demand.setDeliveryLocation(result.getLocation());
        demand.setAdditionalRequirements(result.getAdditionalRequirements());
        demand.setDemandStatus("pending");
        demand.setPublishTime(new Date());
        demand.setCreateTime(new Date());
        demand.setUpdateTime(new Date());
        demand.setDelFlag(0);

        return demand;
    }

    @Override
    public INlpParseService.ParsedDemandResult parseAndExtract(String naturalText) {
        INlpParseService.ParsedDemandResult result = new INlpParseService.ParsedDemandResult();

        result.setProductName(extractProductName(naturalText));
        result.setQuality(extractQuality(naturalText));
        result.setLocation(extractLocation(naturalText));
        result.setTimeRange(extractTime(naturalText));

        Matcher quantityMatcher = QUANTITY_PATTERN.matcher(naturalText);
        if (quantityMatcher.find()) {
            result.setQuantity(quantityMatcher.group(1));
            result.setUnit(quantityMatcher.group(4));
        }

        Matcher priceMatcher = PRICE_PATTERN.matcher(naturalText);
        if (priceMatcher.find()) {
            result.setPrice(priceMatcher.group(1));
        }

        result.setAdditionalRequirements(extractAdditionalRequirements(naturalText, result));

        return result;
    }

    @Override
    public String extractProductName(String text) {
        Matcher matcher = PRODUCT_PATTERN.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    @Override
    public String extractQuantity(String text) {
        Matcher matcher = QUANTITY_PATTERN.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    @Override
    public String extractPrice(String text) {
        Matcher matcher = PRICE_PATTERN.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    @Override
    public String extractLocation(String text) {
        Matcher matcher = LOCATION_PATTERN.matcher(text);
        StringBuilder locations = new StringBuilder();
        while (matcher.find()) {
            if (locations.length() > 0) {
                locations.append(" ");
            }
            locations.append(matcher.group(1));
        }
        return locations.length() > 0 ? locations.toString() : null;
    }

    @Override
    public String extractTime(String text) {
        Matcher matcher = TIME_PATTERN.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    @Override
    public String extractQuality(String text) {
        Matcher matcher = QUALITY_PATTERN.matcher(text);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    private String getCategoryCode(String productName) {
        if (productName == null) return "other";
        if (productName.contains("玉米") || productName.contains("小麦") || productName.contains("水稻") || productName.contains("大豆")) {
            return "grain";
        } else if (productName.contains("蔬菜") || productName.contains("水果")) {
            return "vegetable";
        } else if (productName.contains("猪肉") || productName.contains("牛肉") || productName.contains("鸡蛋") || productName.contains("牛奶")) {
            return "livestock";
        } else if (productName.contains("化肥") || productName.contains("农药") || productName.contains("种子") || productName.contains("饲料")) {
            return "agri_input";
        }
        return "other";
    }

    private String extractAdditionalRequirements(String text, ParsedDemandResult result) {
        String cleaned = text;
        if (result.getProductName() != null) {
            cleaned = cleaned.replace(result.getProductName(), "");
        }
        if (result.getQuantity() != null && result.getUnit() != null) {
            cleaned = cleaned.replace(result.getQuantity() + result.getUnit(), "");
        }
        if (result.getPrice() != null) {
            cleaned = cleaned.replace(result.getPrice(), "");
        }
        if (result.getLocation() != null) {
            for (String loc : result.getLocation().split(" ")) {
                cleaned = cleaned.replace(loc, "");
            }
        }
        if (result.getTimeRange() != null) {
            cleaned = cleaned.replace(result.getTimeRange(), "");
        }
        if (result.getQuality() != null) {
            cleaned = cleaned.replace(result.getQuality(), "");
        }
        
        cleaned = cleaned.replaceAll("[，,。.、/\\\\]", " ").trim();
        cleaned = cleaned.replaceAll("\\s+", " ").trim();
        
        return cleaned.length() > 0 ? cleaned : null;
    }
}