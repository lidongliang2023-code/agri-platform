package com.agri.ai.service;
import org.springframework.stereotype.Component;
import java.util.*;
@Component
public class AiSceneCatalog {
    public record Scene(String code, String name, String bizSystem, String domain, String description, String exampleJson) {}
    private final List<Scene> scenes = List.of(
        new Scene("farm.voice.record", "语音农事结构化提取", "farm_prod", "农事生产", "提取口述事实候选，人工确认后归档，不生成任务或处方", "{\"transcript\":\"今天在北棚放风两小时\",\"recordedAt\":\"2026-11-14T10:00:00\",\"plots\":[],\"inputs\":[],\"members\":[]}"),
        new Scene("farm.crop.schedule", "农事排程建议", "farm_prod", "农事生产", "根据作物与生育阶段返回农事安排参考", "{\"crop\": \"柑橘\", \"stage\": \"果实膨大期\"}"),
        new Scene("farm.pest.diagnosis", "病虫害诊断参考", "farm_prod", "农事生产", "演示病虫害诊断输出结构，不作为真实诊断", "{\"symptom\": \"叶片卷曲，存在虫道\"}"),
        new Scene("iot.device.anomaly", "设备异常分析", "iot_sensor", "物联网", "演示设备异常原因与处置建议", "{\"deviceType\": \"土壤传感器\", \"readings\": [2.8, 4.9, 2.7]}"),
        new Scene("iot.env.strategy", "环境调控策略", "iot_sensor", "物联网", "演示温室环境调控策略", "{\"temperature\": 32, \"humidity\": 75}"),
        new Scene("trade.price.diagnosis", "价格波动分析", "trade_match", "大宗交易", "演示行情归因与价格分析结构", "{\"variety\": \"沃柑\", \"prices\": [4.8, 5.0, 5.2]}"),
        new Scene("trade.order.match", "供需智能撮合", "trade_match", "大宗交易", "演示采购商匹配与评分结构", "{\"product\": \"沃柑\", \"quantity\": 40}"),
        new Scene("s2b2c.inventory.forecast", "库存补货预测", "s2b2c", "供销商城", "演示备货与周转建议", "{\"sales\": [120, 150, 180], \"stock\": 300}"),
        new Scene("s2b2c.goods.copywrite", "商品文案生成", "s2b2c", "供销商城", "演示商品标题与卖点输出", "{\"product\": \"红肉蜜柚\", \"origin\": \"漳州平和\"}"),
        new Scene("gov.market.monitor", "市场运行监测", "gov_supervise", "政府监管", "演示区域市场运行指标与研判", "{\"region\": \"示范产区\"}"),
        new Scene("gov.safety.alert", "质量安全预警", "gov_supervise", "政府监管", "演示抽检风险与处置建议", "{\"batches\": 142, \"suspectBatches\": 3}"),
        new Scene("fin.credit.assessment", "授信评估参考", "supply_fin", "供应链金融", "演示授信评分结构，不用于审批决策", "{\"enterprise\": \"示范合作社\", \"fulfillmentRate\": 0.99}"),
        new Scene("fin.pledge.risk", "质押风险分析", "supply_fin", "供应链金融", "演示仓单质押风险参考", "{\"warehouseReceiptId\": \"DEMO-001\"}"),
        new Scene("info.digest.extract", "资讯摘要提取", "info_news", "信息资讯", "演示资讯摘要和关键词结构", "{\"text\": \"推进农业绿色低碳发展与水肥一体化技术应用。\"}"),
        new Scene("info.topic.cluster", "资讯主题聚合", "info_news", "信息资讯", "演示主题归类与聚合结果", "{\"topics\": [\"绿色农业\", \"产业发展\"]}"),
        new Scene("service.advisor.dialog", "农业顾问问答", "service_hub", "综合服务", "演示数字农业咨询回复", "{\"query\": \"如何接入温室监控？\"}"),
        new Scene("service.lead.qualify", "服务需求研判", "service_hub", "综合服务", "演示需求意向与服务建议", "{\"demand\": \"基地数字化与质量溯源建设\"}"));
    public List<Scene> list() { return scenes; }
    public Scene require(String code) { return scenes.stream().filter(s -> s.code().equals(code)).findFirst()
        .orElseThrow(() -> new IllegalArgumentException("场景编码不存在，请从场景目录选择")); }
}
