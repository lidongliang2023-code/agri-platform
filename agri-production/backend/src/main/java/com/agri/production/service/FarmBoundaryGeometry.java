package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/** 农场边界只支持一个无孔洞的简单多边形，GeoJSON 顺序为经度、纬度。 */
public final class FarmBoundaryGeometry {
    private static final ObjectMapper JSON = new ObjectMapper();
    private FarmBoundaryGeometry() {}
    public static String normalize(String boundary, boolean clear) {
        if (clear) {
            if (boundary != null) throw invalid("清空边界时不能同时提交边界数据");
            return null;
        }
        if (boundary == null) return null;
        if (boundary.length() > 60000) throw invalid("边界数据过大");
        try {
            JsonNode geometry = JSON.readTree(boundary);
            if (geometry == null || !"Polygon".equals(geometry.path("type").asText())) throw invalid("请提交GeoJSON Polygon农场边界");
            JsonNode rings = geometry.path("coordinates");
            if (!rings.isArray() || rings.size() != 1 || !rings.get(0).isArray()) throw invalid("农场边界须为一个不含孔洞的多边形");
            JsonNode ring = rings.get(0);
            if (ring.size() < 4 || ring.size() > 501) throw invalid("边界需要3至500个顶点并首尾闭合");
            List<double[]> points = new ArrayList<>();
            for (JsonNode point : ring) {
                if (!point.isArray() || point.size() != 2 || !point.get(0).isNumber() || !point.get(1).isNumber()) throw invalid("顶点须为数值经纬度坐标对");
                double x=point.get(0).asDouble(), y=point.get(1).asDouble();
                if (!Double.isFinite(x)||!Double.isFinite(y)||x < -180||x > 180||y < -90||y > 90) throw invalid("边界经纬度越界");
                points.add(new double[]{x,y});
            }
            int n=points.size()-1;
            if (!Arrays.equals(points.get(0), points.get(n))) throw invalid("边界必须首尾闭合");
            Set<String> unique=new HashSet<>();
            for (int i=0;i<n;i++) {
                double[] p=points.get(i);
                if (!unique.add(p[0]+":"+p[1])) throw invalid("边界顶点不能重复");
            }
            double area=0; double[] origin=points.get(0);
            for(int i=0;i<n;i++) {
                double[] a=points.get(i),c=points.get(i+1);
                area+=(a[0]-origin[0])*(c[1]-origin[1])-(c[0]-origin[0])*(a[1]-origin[1]);
                for(int j=i+1;j<n;j++) {
                    if(j==i+1 || (i==0 && j==n-1)) continue;
                    if(intersects(a,c,points.get(j),points.get(j+1))) throw invalid("边界不能自交或重叠，请按顺序绘制");
                }
                double[] prev=points.get((i+n-1)%n),next=points.get(i+1);
                if(Math.abs(cross(prev,a,next))<1e-14 && (prev[0]-a[0])*(next[0]-a[0])+(prev[1]-a[1])*(next[1]-a[1])>0) throw invalid("边界不能折返重叠");
            }
            if(Math.abs(area)<1e-12) throw invalid("边界面积为零或过小");
            return JSON.writeValueAsString(Map.of("type","Polygon","coordinates",List.of(points)));
        } catch (BusinessException e) { throw e; }
          catch (Exception e) { throw invalid("农场边界不是有效的GeoJSON"); }
    }
    /** 兼容旧版地块平铺坐标；位置点不视为完整地块边界。 */
    public static String normalizePlot(String boundary) {
        if (boundary==null || boundary.isBlank()) return null;
        if (boundary.length()>60000) throw invalid("地块边界数据过大");
        try {
            JsonNode node=JSON.readTree(boundary);
            if (node==null || !node.isObject()) throw invalid("地块边界不是有效的GeoJSON");
            JsonNode coordinates=node.path("coordinates");
            if ("Point".equals(node.path("type").asText())) {
                if (!coordinates.isArray() || coordinates.size()!=2 || !coordinates.get(0).isNumber() || !coordinates.get(1).isNumber()) throw invalid("地块位置须为数值经纬度坐标对");
                double x=coordinates.get(0).asDouble(),y=coordinates.get(1).asDouble();
                if (!Double.isFinite(x)||!Double.isFinite(y)||x< -180||x>180||y< -90||y>90) throw invalid("地块位置经纬度越界");
                return JSON.writeValueAsString(node);
            }
            if ("Polygon".equals(node.path("type").asText()) && coordinates.isArray() && !coordinates.isEmpty()
                && coordinates.get(0).isArray() && !coordinates.get(0).isEmpty() && coordinates.get(0).get(0).isNumber()) {
                ((com.fasterxml.jackson.databind.node.ObjectNode)node).set("coordinates",JSON.createArrayNode().add(coordinates));
            }
            String normalized=normalize(JSON.writeValueAsString(node),false);
            var result=(com.fasterxml.jackson.databind.node.ObjectNode)JSON.readTree(normalized);
            if (node.has("slope")) result.set("slope",node.get("slope"));
            return JSON.writeValueAsString(result);
        } catch (BusinessException e) { throw e; }
          catch (Exception e) { throw invalid("地块边界不是有效的GeoJSON"); }
    }
    public static boolean isPolygon(String value) {
        try { return "Polygon".equals(JSON.readTree(value).path("type").asText()); }
        catch (Exception e) { return false; }
    }
    /** 面差集为空即完全覆盖，允许边重合；完整边段也参与计算，避免凹形顶点误判。 */
    public static boolean covers(String farmBoundary,String plotBoundary) {
        try {
            java.awt.geom.Area outside=area(JSON.readTree(normalizePlot(plotBoundary)));
            outside.subtract(area(JSON.readTree(normalize(farmBoundary,false))));
            return outside.isEmpty();
        } catch (BusinessException e) { throw e; }
          catch (Exception e) { throw invalid("无法计算农场与地块边界关系"); }
    }

    /**
     * 判断两个地块是否存在正面积重叠。
     * 仅共边、共点或边界相切不算重叠，允许相邻地块无缝拼接。
     */
    public static boolean overlaps(String firstBoundary,String secondBoundary) {
        java.awt.geom.Area first=plotArea(firstBoundary),second=plotArea(secondBoundary);
        return first!=null && second!=null && overlaps(first,second);
    }
    /** 缺边界或只有位置点返回空；异常多边形明确抛错。 */
    static java.awt.geom.Area plotArea(String boundary) {
        String normalized=normalizePlot(boundary);
        if (!isPolygon(normalized)) return null;
        try { return area(JSON.readTree(normalized)); }
        catch (Exception e) { throw invalid("无法计算地块边界"); }
    }
    /** Area 不含共边、共点形成的零面积交集，避免经纬度面积阈值漏掉细长重叠。 */
    static boolean overlaps(java.awt.geom.Area first,java.awt.geom.Area second) {
        if (!first.getBounds2D().intersects(second.getBounds2D())) return false;
        java.awt.geom.Area intersection=new java.awt.geom.Area(first);
        intersection.intersect(second);
        return !intersection.isEmpty();
    }

    private static java.awt.geom.Area area(JsonNode geometry) {
        JsonNode ring=geometry.path("coordinates").path(0);
        java.awt.geom.Path2D.Double path=new java.awt.geom.Path2D.Double();
        for (int i=0;i<ring.size();i++) {
            double x=ring.get(i).get(0).asDouble(),y=ring.get(i).get(1).asDouble();
            if (i==0) path.moveTo(x,y); else path.lineTo(x,y);
        }
        path.closePath(); return new java.awt.geom.Area(path);
    }

    private static double cross(double[] a,double[] b,double[] c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
    private static boolean on(double[] a,double[] b,double[] p){return Math.abs(cross(a,b,p))<1e-14 && p[0]>=Math.min(a[0],b[0])-1e-12 && p[0]<=Math.max(a[0],b[0])+1e-12 && p[1]>=Math.min(a[1],b[1])-1e-12 && p[1]<=Math.max(a[1],b[1])+1e-12;}
    private static boolean intersects(double[] a,double[] b,double[] c,double[] d){
        double x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
        return (x*y<0 && z*w<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
    }
    private static BusinessException invalid(String message){return new BusinessException(400,message);}
}
