package com.agri.service.repository;

import java.util.Map;

final class PolicyReviewText {
    private static final Map<String, String> LABELS = Map.of(
            "submitted", "已提交", "town_review", "乡镇审核中", "county_review", "区县审核中",
            "paid", "已兑付", "rejected", "已驳回");

    private PolicyReviewText() {}

    static String label(String status) {
        return LABELS.getOrDefault(status, "状态待确认");
    }

    static void normalizeLegacyMessage(Map<String, Object> message) {
        String type = String.valueOf(message.get("type"));
        if (!("order".equals(type) || "policy".equals(type))
                || !"政策申报进度更新".equals(message.get("title"))
                || !(message.get("bizNo") instanceof String number) || !number.matches("SQ[0-9]+")
                || !(message.get("content") instanceof String content)) {
            return;
        }
        String marker = "》申报 " + number + " 当前状态：";
        int markerIndex = content.indexOf(marker);
        if (!content.startsWith("《") || markerIndex < 0) return;
        int start = markerIndex + marker.length();
        int end = content.indexOf('。', start);
        if (end < 0) return;
        String label = LABELS.get(content.substring(start, end));
        if (label == null) return;
        message.put("type", "policy");
        message.put("bizType", "POLICY");
        message.put("content", content.substring(0, start) + label + content.substring(end));
    }
}
