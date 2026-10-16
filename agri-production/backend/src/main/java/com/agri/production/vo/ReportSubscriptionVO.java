package com.agri.production.vo;

import com.agri.production.entity.ReportSubscription;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * 报表订阅出参（页面 ReportSubscription）。
 *
 * <p>delivery 恒为 not-configured：本部署没有任何消息通道，订阅只会落一行、不会真的推送。
 * 把这个事实放进响应体而不是只写在文档里，是为了让"订阅了却永远收不到"在联调第一天就看得见。</p>
 */
@Data
public class ReportSubscriptionVO {

    /** 本部署未接推送通道（固定值，见类注释） */
    public static final String DELIVERY_NOT_CONFIGURED = "not-configured";

    private static final DateTimeFormatter DATETIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final ObjectMapper JSON = new ObjectMapper();

    private String subscribeId;
    private Integer reportType;
    /** daily / weekly / monthly / quarterly */
    private String period;
    /** 接收渠道编码列表（1 站内 2 邮件 3 微信） */
    private List<Integer> channels;
    private List<String> receivers;
    /** 1 启用 0 停用 */
    private Integer status;
    /** 最近推送时间（无通道，恒为空） */
    private String lastPushedAt;
    private String updatedAt;
    /** 固定 not-configured */
    private String delivery;

    public static ReportSubscriptionVO of(ReportSubscription entity) {
        if (entity == null) {
            return null;
        }
        ReportSubscriptionVO vo = new ReportSubscriptionVO();
        vo.subscribeId = entity.getSubscribeId();
        vo.reportType = entity.getReportType();
        vo.period = entity.getPeriod();
        vo.channels = readInts(entity.getChannels());
        vo.receivers = readStrings(entity.getReceivers());
        vo.status = entity.getStatus();
        vo.lastPushedAt = entity.getLastPushedAt() == null ? null : DATETIME.format(entity.getLastPushedAt());
        vo.updatedAt = entity.getUpdateTime() == null ? null : DATETIME.format(entity.getUpdateTime());
        vo.delivery = DELIVERY_NOT_CONFIGURED;
        return vo;
    }

    private static List<Integer> readInts(String raw) {
        List<Integer> result = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return result;
        }
        try {
            for (Object item : JSON.readValue(raw, new TypeReference<List<Object>>() {
            })) {
                if (item instanceof Number number) {
                    result.add(number.intValue());
                } else if (item != null) {
                    result.add(Integer.valueOf(String.valueOf(item).trim()));
                }
            }
        } catch (Exception e) {
            // 存储格式非法时按"未配置渠道"返回空列表，不猜
        }
        return result;
    }

    private static List<String> readStrings(String raw) {
        List<String> result = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return result;
        }
        try {
            for (Object item : JSON.readValue(raw, new TypeReference<List<Object>>() {
            })) {
                if (item != null && !String.valueOf(item).isBlank()) {
                    result.add(String.valueOf(item).trim());
                }
            }
        } catch (Exception e) {
            // 同上：不猜
        }
        return result;
    }
}
