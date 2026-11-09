package com.agri.info.integration;

import java.util.*;
import java.time.*;

/** 自包含、无脚本报告；打印样式用于浏览器另存 PDF，不请求外部资源。 */
public final class GreenReportRenderer {
    private GreenReportRenderer() {}
    private static String e(Object v) { return Objects.toString(v, "").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;"); }
    private static String scope(String s) { return switch(s) {case "scope1" -> "范围一：直接排放";case "scope2" -> "范围二：外购能源";case "scope3" -> "范围三：价值链其他间接排放";default -> s;}; }
    private static String state(Object s) { return switch(Objects.toString(s,"")) {case "published" -> "已发布";case "review" -> "待审核（非正式发布报告）";case "returned" -> "已退回 / 撤回（非正式发布报告）";default -> "草稿（非正式发布报告）";}; }
    private static void field(StringBuilder h,String label,Object value) { h.append("<p><b>").append(e(label)).append("：</b>").append(e(value)).append("</p>"); }
    private static void link(StringBuilder h,String label,Object value) {
        String url=Objects.toString(value,"");
        if(url.startsWith("https://") || (url.startsWith("/")&&!url.startsWith("//")&&!url.contains("\\"))) {
            h.append("<p><b>").append(e(label)).append("：</b><a rel=\"noopener noreferrer\" href=\"").append(e(url)).append("\">").append(e(url)).append("</a></p>");
        } else field(h,label,url);
    }
    @SuppressWarnings("unchecked")
    public static String render(Map<String,Object> d) {
        StringBuilder h=new StringBuilder("<!doctype html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"referrer\" content=\"no-referrer\"><title>");
        h.append(e(d.get("title"))).append(" · 碳核算报告</title><style>")
         .append("@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:14px/1.75 system-ui,'Microsoft YaHei',sans-serif;color:#203c2d;margin:0;background:#f2f6f3}main{max-width:960px;margin:24px auto;background:white;padding:36px}h1{font-size:26px}h2{font-size:19px;border-bottom:2px solid #23744e;padding-bottom:8px;margin-top:30px}h3{font-size:16px}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0}a{color:#17603c;overflow-wrap:anywhere}.badge{padding:12px;background:#eef5ef;border-left:4px solid #23744e}table{border-collapse:collapse;width:100%;margin:15px 0}td,th{border:1px solid #ccdcd1;text-align:left;padding:9px;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.item{border-bottom:1px solid #ccdcd1;padding:10px 0}footer{margin-top:32px;font-size:12px;color:#56675c}.hint{color:#56675c}@media print{body{background:white}main{margin:0;padding:0;max-width:none}.screen-only{display:none}h2,h3{break-after:avoid}a{color:inherit;text-decoration:none}}")
         .append("</style></head><body><main><p class=\"screen-only hint\">可使用浏览器打印功能另存为 PDF。此文件是导出时的静态快照，当前有效状态以平台记录为准。</p><h1>碳核算报告</h1><h2>").append(e(d.get("title"))).append("</h2><div class=\"badge\">");
        field(h,"报告编号","GS-"+d.get("id"));field(h,"记录版本",d.get("revision"));field(h,"导出时状态",state(d.get("status")));h.append("</div>");
        field(h,"导出时间（北京时间）",LocalDateTime.now(ZoneId.of("Asia/Shanghai")).toString());
        h.append("<h2>一、核算主体与边界</h2>");
        for(String[] f:new String[][]{{"enterprise","核算主体"},{"boundary","组织 / 产品边界"},{"methodology","方法与采用标准"},{"periodStart","核算开始日期"},{"periodEnd","核算结束日期"},{"calculatedAt","核算时间"}})field(h,f[1],d.get(f[0]));
        h.append("<h2>二、排放汇总</h2>");field(h,"排放总量",d.get("totalKg")+" kgCO₂e / "+d.get("totalTonnes")+" tCO₂e");
        Map<String,Object> totals=(Map<String,Object>)d.getOrDefault("scopeTotalsKg",Map.of());
        h.append("<table><thead><tr><th>排放范围</th><th>已录入活动排放量（kgCO₂e）</th></tr></thead><tbody>");
        for(String s:List.of("scope1","scope2","scope3"))h.append("<tr><td>").append(scope(s)).append("</td><td>").append(e(totals.containsKey(s)?totals.get(s):"未录入该范围活动（不代表零排放）")).append("</td></tr>");
        h.append("</tbody></table><h2>三、活动明细与因子版本</h2>");
        List<Map<String,Object>>items=(List<Map<String,Object>>)d.getOrDefault("items",List.of());int n=0;
        for(Map<String,Object>x:items){Map<String,Object>f=(Map<String,Object>)x.get("factorSnapshot");h.append("<section class=\"item\"><h3>").append(++n).append(". ").append(e(x.get("name"))).append("</h3>");
            field(h,"计算过程",x.get("amount")+" "+x.get("unit")+" × "+f.get("value")+" kgCO₂e/"+f.get("unit")+" = "+x.get("emissionKg")+" kgCO₂e");
            String domain=switch(Objects.toString(x.get("domain"),"")){case "production"->"生产管理";case "iot"->"物联网";case "logistics"->"物流服务";case "trade"->"交易";default->"人工凭证";};
            field(h,"活动来源",domain+" / "+x.get("sourceRef"));field(h,"活动日期",x.get("observedOn"));field(h,"排放范围",scope(Objects.toString(f.get("scope"),"")));
            field(h,"因子编号 / 名称",x.get("factorId")+" / "+f.get("title"));field(h,"因子版本",f.get("version"));field(h,"因子适用活动与地区",f.get("activity"));field(h,"因子适用期间",f.get("validFrom")+" 至 "+f.get("validUntil"));link(h,"活动凭证",x.get("evidence"));link(h,"因子出处",f.get("reference"));h.append("</section>");
        }
        h.append("<h2>四、数据局限与说明</h2>");field(h,"数据缺口与排除事项",d.get("limitations"));
        h.append("<p>计算采用活动量 × 保存的排放因子快照。仅汇总已录入的活动，不自动换算单位，不包含未经录入的排放、碳汇和碳抵销，不代表完整生命周期评价或第三方核查结论。</p><h2>五、审核与状态记录</h2>");
        if("published".equals(d.get("status")))field(h,"当前版本发布时间",d.get("publishedAt"));
        field(h,"最近处理说明",d.getOrDefault("reviewNote","暂无"));
        for(Map<String,Object>x:(List<Map<String,Object>>)d.getOrDefault("history",List.of())){field(h,"处理时间",x.get("at"));field(h,"状态变更",state(x.get("from"))+" → "+state(x.get("to")));field(h,"处理说明",x.get("note"));}
        h.append("<footer>本报告由绿色供应链核算记录导出。平台审核不等同于外部认证或法定核查。导出文件不随撤回或后续修改自动更新，请以平台内同编号和版本的当前状态为准。</footer></main></body></html>");return h.toString();
    }
}
