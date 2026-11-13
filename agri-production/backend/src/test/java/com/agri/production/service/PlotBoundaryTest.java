package com.agri.production.service;

import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.agri.production.common.exception.BusinessException;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import java.util.List;

class PlotBoundaryTest {
    static String polygon(String ring) { return "{\"type\":\"Polygon\",\"coordinates\":["+ring+"]}"; }
    static final String FARM=polygon("[[0,0],[10,0],[10,10],[0,10],[0,0]]");
    static final String INSIDE=polygon("[[1,1],[2,1],[2,2],[1,2],[1,1]]");
    static final String OUTSIDE=polygon("[[9,9],[11,9],[11,11],[9,11],[9,9]]");
    static Farm farm() { var f=new Farm();f.setId(1L);f.setTenantId("t1");f.setBoundary(FARM);return f; }
    @BeforeAll static void metadata() {
        for (Class<?> type:List.of(Farm.class,Plot.class)) TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(),"plot-boundary"),type);
    }
    @Test void containsTouchesAndReverseOrientation() {
        assertTrue(FarmBoundaryGeometry.covers(FARM,INSIDE));
        assertTrue(FarmBoundaryGeometry.covers(FARM,FARM));
        assertTrue(FarmBoundaryGeometry.covers(FARM,polygon("[[0,0],[0,2],[2,2],[2,0],[0,0]]")));
        assertFalse(FarmBoundaryGeometry.covers(FARM,OUTSIDE));
        assertFalse(FarmBoundaryGeometry.covers(FARM,polygon("[[-1,-1],[11,-1],[11,11],[-1,11],[-1,-1]]")));
    }
    @Test void catchesConcaveExitEvenWhenAllVerticesInside() {
        String concave=polygon("[[0,0],[6,0],[6,6],[4,6],[4,2],[2,2],[2,6],[0,6],[0,0]]");
        String bridge=polygon("[[1,5],[5,5],[5,1],[1,1],[1,5]]");
        assertFalse(FarmBoundaryGeometry.covers(concave,bridge));
        String vertexCross=polygon("[[1,4],[4,1],[1,1],[1,4]]");
        assertFalse(FarmBoundaryGeometry.covers(concave,vertexCross));
    }
    @Test void acceptsHistoricalFlatRingAndPreservesSlope() {
        String legacy="{\"type\":\"Polygon\",\"slope\":\"平地\",\"coordinates\":[[1,1],[2,1],[2,2],[1,2],[1,1]]}";
        String normalized=FarmBoundaryGeometry.normalizePlot(legacy);
        assertTrue(normalized.contains("平地"));
        assertTrue(FarmBoundaryGeometry.covers(FARM,legacy));
        assertEquals("inside",PlotBoundaryService.check(FARM,normalized).status());
    }
    @Test void overlapAllowsSharedEdgeAndRejectsPositiveAreaIntersection() {
        String adjacent=polygon("[[2,1],[3,1],[3,2],[2,2],[2,1]]");
        String touching=polygon("[[2,2],[3,2],[3,3],[2,3],[2,2]]");
        String overlap=polygon("[[1.5,1],[2.5,1],[2.5,2],[1.5,2],[1.5,1]]");
        String contains=polygon("[[0.5,0.5],[3,0.5],[3,3],[0.5,3],[0.5,0.5]]");
        assertFalse(FarmBoundaryGeometry.overlaps(INSIDE,adjacent));
        assertFalse(FarmBoundaryGeometry.overlaps(INSIDE,touching));
        assertTrue(FarmBoundaryGeometry.overlaps(INSIDE,overlap));
        assertTrue(FarmBoundaryGeometry.overlaps(INSIDE,contains));
        assertTrue(FarmBoundaryGeometry.overlaps(INSIDE,INSIDE));
        assertFalse(FarmBoundaryGeometry.overlaps(INSIDE,null));
    }
    @Test void missingBoundariesAndPointsRemainPending() {
        assertEquals("farm_missing",PlotBoundaryService.check(null,INSIDE).status());
        assertEquals("plot_missing",PlotBoundaryService.check(FARM,null).status());
        assertEquals("plot_missing",PlotBoundaryService.check(FARM,"{\"type\":\"Point\",\"coordinates\":[1,1]}").status());
    }
    @Test void invalidRingsAreNeverReportedInside() {
        assertEquals("invalid",PlotBoundaryService.check(FARM,"broken").status());
        assertEquals("invalid",PlotBoundaryService.check(FARM,polygon("[[1,1],[3,3],[1,3],[3,1],[1,1]]")).status());
        assertEquals("invalid",PlotBoundaryService.check("broken",INSIDE).status());
    }
    @Test void writesLockFarmAndRejectOtherTenantAndOutside() {
        var farms=mock(FarmMapper.class);var plots=mock(PlotMapper.class);
        when(farms.boundaryForUpdate(1L)).thenReturn(farm());
        var service=new PlotBoundaryService(farms,plots);
        assertEquals(FarmBoundaryGeometry.normalize(INSIDE,false),FarmBoundaryGeometry.normalize(service.validatePlot(1L,"t1",INSIDE),false));
        var sibling=new Plot(); sibling.setId(9L); sibling.setPlotName("已有地块"); sibling.setTenantId("t1"); sibling.setFarmId(1L); sibling.setBoundary(INSIDE);
        when(plots.selectList(any())).thenReturn(List.of(sibling));
        assertThrows(BusinessException.class,()->service.validatePlot(1L,"t1",polygon("[[1.5,1],[2.5,1],[2.5,2],[1.5,2],[1.5,1]]")));
        when(plots.selectList(any())).thenAnswer(invocation -> {
            com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<Plot> wrapper=invocation.getArgument(0);
            assertTrue(wrapper.getSqlSegment().contains("id <>"));
            assertTrue(wrapper.getSqlSegment().contains("FOR UPDATE"));
            assertTrue(wrapper.getParamNameValuePairs().containsValue(9L));
            return List.of();
        });
        assertDoesNotThrow(()->service.validatePlot(1L,"t1",INSIDE,9L));
        assertThrows(BusinessException.class,()->service.validatePlot(1L,"other",INSIDE));
        assertThrows(BusinessException.class,()->service.validatePlot(1L,"t1",OUTSIDE));
        verify(farms,times(5)).boundaryForUpdate(1L);
    }
    @Test void farmShrinkRejectsExistingOutsidePlotBeforeWrite() {
        var plots=mock(PlotMapper.class);var p=new Plot();p.setId(7L);p.setPlotName("北侧地块");p.setBoundary(OUTSIDE);
        when(plots.selectList(any())).thenReturn(List.of(p));
        var error=assertThrows(BusinessException.class,()->PlotBoundaryService.assertFarmChange(plots,farm(),FARM));
        assertTrue(error.getMessage().contains("北侧地块"));
        assertDoesNotThrow(()->PlotBoundaryService.assertFarmChange(plots,farm(),null));
    }
    @Test void reportListsAllStatesWithoutWriting() {
        var farms=mock(FarmMapper.class);var plots=mock(PlotMapper.class);
        var a=new Plot();a.setId(1L);a.setBoundary(INSIDE);
        var b=new Plot();b.setId(2L);b.setBoundary(OUTSIDE);
        var c=new Plot();c.setId(3L);
        when(plots.selectList(any())).thenReturn(List.of(a,b,c));
        var rows=new PlotBoundaryService(farms,plots).report(farm());
        assertEquals(List.of("inside","outside","plot_missing"),rows.stream().map(r->r.get("status")).toList());
        verifyNoInteractions(farms); verify(plots).selectList(any()); verifyNoMoreInteractions(plots);
    }
    static Plot plot(Long id,String name,String boundary) {
        var plot=new Plot(); plot.setId(id); plot.setFarmId(1L); plot.setTenantId("t1"); plot.setPlotName(name); plot.setBoundary(boundary); return plot;
    }
    @Test void reportsOverlapWithoutFarmBoundaryBothDirectionsAndKeepsRange() {
        var farms=mock(FarmMapper.class); var plots=mock(PlotMapper.class);
        var a=plot(1L,"东侧",INSIDE);
        var b=plot(2L,"西侧",polygon("[[1.5,1],[2.5,1],[2.5,2],[1.5,2],[1.5,1]]"));
        when(plots.selectList(any())).thenReturn(List.of(a,b));
        var f=farm(); f.setBoundary(null);
        var rows=new PlotBoundaryService(farms,plots).report(f);
        assertEquals(List.of("farm_missing","farm_missing"),rows.stream().map(r->r.get("status")).toList());
        assertEquals(List.of("overlap","overlap"),rows.stream().map(r->r.get("overlapStatus")).toList());
        assertTrue(rows.get(0).get("overlapMessage").toString().contains("西侧"));
        assertTrue(rows.get(1).get("overlapMessage").toString().contains("东侧"));
        verifyNoInteractions(farms);
    }
    @Test void invalidSiblingDoesNotMislabelValidPlotButBlocksUnverifiableSave() {
        var farms=mock(FarmMapper.class); var plots=mock(PlotMapper.class);
        when(farms.boundaryForUpdate(1L)).thenReturn(farm());
        when(plots.selectList(any())).thenReturn(List.of(plot(1L,"正常",INSIDE),plot(2L,"异常","broken")));
        var service=new PlotBoundaryService(farms,plots);
        var rows=service.report(farm());
        assertEquals("inside",rows.get(0).get("status"));
        assertEquals("incomplete",rows.get(0).get("overlapStatus"));
        assertEquals("invalid",rows.get(1).get("overlapStatus"));
        when(plots.selectList(any())).thenReturn(List.of(plot(2L,"异常","broken")));
        assertTrue(assertThrows(BusinessException.class,()->service.validatePlot(1L,"t1",INSIDE)).getMessage().contains("异常"));
    }
    @Test void previewSharesSaveRulesValidatesEditOwnershipAndNeverLocks() {
        var farms=mock(FarmMapper.class); var plots=mock(PlotMapper.class);
        when(plots.selectList(any())).thenReturn(List.of(plot(2L,"冲突地块",INSIDE)));
        var service=new PlotBoundaryService(farms,plots);
        var f=farm(); f.setBoundary(null);
        assertEquals("overlap",service.preview(f,INSIDE,null).status());
        when(plots.selectById(1L)).thenReturn(plot(1L,"自己",INSIDE));
        when(plots.selectList(any())).thenReturn(List.of());
        assertEquals("inside",service.preview(farm(),INSIDE,1L).status());
        var foreign=plot(3L,"其他主体",INSIDE); foreign.setTenantId("t2");
        when(plots.selectById(3L)).thenReturn(foreign);
        assertThrows(BusinessException.class,()->service.preview(farm(),INSIDE,3L));
        verifyNoInteractions(farms);
    }
    @Test void crossShapeWithoutContainedVerticesAndSmallRealCoordinatesOverlap() {
        String vertical=polygon("[[2,0],[3,0],[3,5],[2,5],[2,0]]");
        String horizontal=polygon("[[0,2],[5,2],[5,3],[0,3],[0,2]]");
        assertTrue(FarmBoundaryGeometry.overlaps(vertical,horizontal));
        String a=polygon("[[120,30],[120.001,30],[120.001,30.001],[120,30.001],[120,30]]");
        String b=polygon("[[120.00099999,30],[120.002,30],[120.002,30.001],[120.00099999,30.001],[120.00099999,30]]");
        assertTrue(FarmBoundaryGeometry.overlaps(a,b));
        assertTrue(FarmBoundaryGeometry.overlaps(b,a));
    }
    @Test void saveOverlapRuleStillAppliesWhenFarmBoundaryMissingAndIncludesInactivePlots() {
        var farms=mock(FarmMapper.class); var plots=mock(PlotMapper.class);
        var f=farm(); f.setBoundary(null); when(farms.boundaryForUpdate(1L)).thenReturn(f);
        var inactive=plot(4L,"停用地块",INSIDE); inactive.setStatus("inactive");
        when(plots.selectList(any())).thenReturn(List.of(inactive));
        var service=new PlotBoundaryService(farms,plots);
        assertTrue(assertThrows(BusinessException.class,()->service.validatePlot(1L,"t1",INSIDE)).getMessage().contains("停用地块"));
    }

}
