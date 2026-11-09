package com.agri.production.service;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.agri.production.common.exception.BusinessException;
import org.junit.jupiter.api.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
class ProductionDashboardTest {
    FarmMapper farms=mock(FarmMapper.class);
    PlotMapper plots=mock(PlotMapper.class);
    TaskMapper tasks=mock(TaskMapper.class);
    HarvestBatchMapper batches=mock(HarvestBatchMapper.class);
    InspectionMapper inspections=mock(InspectionMapper.class);
    AlertRecordMapper alerts=mock(AlertRecordMapper.class);
    PlantingPlanMapper plans=mock(PlantingPlanMapper.class);
    ProductionDashboardService service=new ProductionDashboardService(farms,plots,tasks,batches,inspections,alerts,plans);
    @BeforeEach void setup(){
        when(plots.selectList(any())).thenReturn(List.of());when(tasks.selectList(any())).thenReturn(List.of());
        when(batches.selectList(any())).thenReturn(List.of());when(inspections.selectList(any())).thenReturn(List.of());
        when(alerts.selectList(any())).thenReturn(List.of());when(plans.selectList(any())).thenReturn(List.of());
        Farm f=new Farm();f.setId(1L);f.setTenantId("2001");when(farms.selectById(1L)).thenReturn(f);
    }
    @Test void weightConversion(){
        assertEquals(0,new BigDecimal("500").compareTo(ProductionDashboardService.kilograms(BigDecimal.ONE,"斤").multiply(BigDecimal.valueOf(1000))));
        assertEquals(BigDecimal.valueOf(1000),ProductionDashboardService.kilograms(BigDecimal.ONE,"吨"));
        assertNull(ProductionDashboardService.kilograms(BigDecimal.TEN,"箱"));
    }
    @Test void rejectForeignFarmBeforeQueries(){Farm f=new Farm();f.setTenantId("other");when(farms.selectById(2L)).thenReturn(f);assertThrows(BusinessException.class,()->service.load("2001",2L,30));verifyNoInteractions(tasks,batches);}
    @Test void rejectUnsupportedPeriod(){assertThrows(BusinessException.class,()->service.load("2001",1L,365));}
    @Test void emptyDoesNotInventPassRate(){var d=service.load("2001",1L,30);assertNull(d.get("passRate"));assertEquals(0,d.get("plotCount"));assertEquals(List.of(),d.get("trend"));}
    @Test void completedQualityAndMixedUnits(){
        Inspection q=new Inspection();q.setStatus("DONE");q.setResult("PASS");when(inspections.selectList(any())).thenReturn(List.of(q));
        HarvestBatch a=new HarvestBatch();a.setQuantity(BigDecimal.TEN);a.setUnit("kg");a.setHarvestDate(LocalDate.now());
        HarvestBatch b=new HarvestBatch();b.setQuantity(BigDecimal.ONE);b.setUnit("吨");b.setHarvestDate(LocalDate.now());
        HarvestBatch c=new HarvestBatch();c.setQuantity(BigDecimal.TEN);c.setUnit("箱");
        when(batches.selectList(any())).thenReturn(List.of(a,b,c));var d=service.load("2001",1L,30);
        assertEquals(BigDecimal.valueOf(1010),d.get("yieldKg"));assertEquals(100.0,d.get("passRate"));assertEquals(1L,d.get("passCount"));
        assertEquals(Map.of("箱",BigDecimal.TEN),d.get("unconverted"));
    }
    @Test void plantingAreaIsDeduplicated(){Plot p=new Plot();p.setId(1L);p.setArea(BigDecimal.TEN);when(plots.selectList(any())).thenReturn(List.of(p));PlantingPlan a=new PlantingPlan();a.setPlotId(1L);when(plans.selectList(any())).thenReturn(List.of(a,a));assertEquals(BigDecimal.TEN,service.load("2001",1L,7).get("plantingArea"));}
}
