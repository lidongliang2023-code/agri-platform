package com.agri.production.vo;

import com.agri.production.entity.ApprovalFlow;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 审批流程配置出参（前端 {@code ApprovalFlowConfig}）。
 *
 * <p>节点列表以 JSON 存在库里，这里解析成数组给出（页面按 {@code nodes[]} 渲染与编辑）。
 * 解析失败时给**空数组**并保留原始 JSON 到 {@code nodesRaw}，
 * 免得因为一段坏 JSON 让整个配置页打不开、也让人看不到坏在哪。</p>
 */
@Data
public class AdminApprovalFlowVO {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String flowId;
    private String flowName;
    private String approvalType;
    private List<Map<String, Object>> nodes;
    /** nodes 解析不出来时，原始 JSON 放这里（正常时为空） */
    private String nodesRaw;
    /** 条件路由（存于 nodes_json 的扩展对象中） */
    private List<Map<String, Object>> conditionRoutes;
    /** 超时升级规则（存于 nodes_json 的扩展对象中） */
    private List<Map<String, Object>> escalations;
    private Integer status;
    private String updatedAt;
    private String createdAt;

    public static AdminApprovalFlowVO of(ApprovalFlow entity) {
        if (entity == null) {
            return null;
        }
        AdminApprovalFlowVO vo = new AdminApprovalFlowVO();
        vo.flowId = entity.getFlowCode();
        vo.flowName = entity.getFlowName();
        vo.approvalType = entity.getApprovalType();
        vo.status = entity.getStatus();
        vo.updatedAt = entity.getUpdateTime() == null ? null : DATE_TIME.format(entity.getUpdateTime());
        vo.createdAt = entity.getCreateTime() == null ? null : DATE_TIME.format(entity.getCreateTime());
        String json = entity.getNodesJson();
        vo.conditionRoutes = List.of();
        vo.escalations = List.of();
        if (json == null || json.isBlank()) {
            vo.nodes = List.of();
        } else {
            try {
                var root = MAPPER.readTree(json);
                if (root.isArray()) {
                    vo.nodes = MAPPER.convertValue(root, new TypeReference<List<Map<String, Object>>>() {
                    });
                } else if (root.isObject()) {
                    vo.nodes = readList(root.get("nodes"));
                    vo.conditionRoutes = readList(root.get("conditionRoutes"));
                    vo.escalations = readList(root.get("escalations"));
                } else {
                    vo.nodes = List.of();
                    vo.nodesRaw = json;
                }
            } catch (Exception e) {
                vo.nodes = List.of();
                vo.nodesRaw = json;
            }
        }
        return vo;
    }

    private static List<Map<String, Object>> readList(com.fasterxml.jackson.databind.JsonNode node) {
        if (node == null || !node.isArray()) {
            return List.of();
        }
        return MAPPER.convertValue(node, new TypeReference<List<Map<String, Object>>>() {
        });
    }
}
