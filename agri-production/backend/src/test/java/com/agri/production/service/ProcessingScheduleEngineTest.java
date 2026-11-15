package com.agri.production.service;

import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static com.agri.production.service.ProcessingScheduleEngine.*;

class ProcessingScheduleEngineTest {
    final LocalDateTime start=LocalDateTime.of(2026,11,16,7,0);
    final ProcessingScheduleEngine engine=new ProcessingScheduleEngine();
    Resource resource(String id,String op,double rate,List<Block> blocks){return new Resource(id,id,op,rate,0.88,start,blocks);}
    Job job(String key,String cat,String grade,double kg,LocalDateTime arrival,LocalDateTime due,List<String> route){return new Job(key,"1","2","SO-1",cat,grade,3,kg,arrival,due,route,0);}
    Result solve(List<Job> jobs,List<Resource> rs,List<Slot> busy){return engine.solve(jobs,rs,busy,start,90,30,4);}
    @Test void effectiveCapacityAndArrival(){var result=solve(List.of(job("J1","绿茶","一级",88,start.plusHours(2),start.plusDays(1),List.of("DRYING"))),List.of(resource("D","DRYING",100,List.of())),List.of());var s=result.slots().get(0);assertEquals(start.plusHours(2),s.start());assertEquals(s.start().plusHours(1),s.end());}
    @Test void sequentialOperations(){var r=solve(List.of(job("J","茶","A",88,start,start.plusDays(1),List.of("DRYING","PACKAGING"))),List.of(resource("D","DRYING",100,List.of()),resource("P","PACKAGING",100,List.of())),List.of());assertEquals(r.slots().get(0).end(),r.slots().get(1).start());}
    @Test void maintenanceAndOccupiedPreventOverlap(){Slot occupied=new Slot("OLD","D","DRYING",start,start,start.plusHours(1),88,0,false,"茶","A");var r=solve(List.of(job("J","茶","A",88,start,start.plusDays(1),List.of("DRYING"))),List.of(resource("D","DRYING",100,List.of(new Block(start.plusHours(1),start.plusHours(3))))),List.of(occupied));assertEquals(start.plusHours(3),r.slots().get(0).start());}
    @Test void categoryAndGradeSetup(){var jobs=List.of(job("A","绿茶","A",88,start,start.plusHours(3),List.of("DRYING")),job("B","绿茶","B",88,start,start.plusHours(4),List.of("DRYING")),job("C","红茶","A",88,start,start.plusHours(8),List.of("DRYING")));var r=solve(jobs,List.of(resource("D","DRYING",100,List.of())),List.of());assertEquals(0,r.slots().get(0).setupMinutes());assertEquals(30,r.slots().get(1).setupMinutes());assertEquals(90,r.slots().get(2).setupMinutes());}
    @Test void noPartialGhostSlots(){var r=solve(List.of(job("J","茶","A",88,start,start.plusDays(1),List.of("DRYING","PACKAGING"))),List.of(resource("D","DRYING",100,List.of())),List.of());assertTrue(r.slots().isEmpty());assertEquals("UNSCHEDULED",r.conflicts().get(0).get("type"));}
    @Test void deadlineConflictHasThreeOptions(){var r=solve(List.of(job("J","茶","A",880,start,start.plusHours(1),List.of("DRYING"))),List.of(resource("D","DRYING",100,List.of())),List.of());assertEquals("LATE",r.conflicts().get(0).get("type"));assertEquals(3,((List<?>)r.conflicts().get(0).get("options")).size());}
    @Test void dailyChangeLimit(){var jobs=new ArrayList<Job>();for(int i=0;i<7;i++)jobs.add(job("J"+i,"C"+i,"A",8.8,start,start.plusHours(i+1),List.of("DRYING")));var r=solve(jobs,List.of(resource("D","DRYING",100,List.of())),List.of());assertTrue(r.slots().get(5).setupStart().toLocalDate().isAfter(start.toLocalDate()));}
    @Test void lateArrivalUnscheduled(){var r=solve(List.of(job("J","茶","A",88,start.plusDays(8),start.plusDays(9),List.of("DRYING"))),List.of(resource("D","DRYING",100,List.of())),List.of());assertTrue(r.slots().isEmpty());}
    @Test void fasterParallelResourceSelected(){var r=solve(List.of(job("J","茶","A",88,start,start.plusDays(1),List.of("DRYING"))),List.of(resource("A","DRYING",50,List.of()),resource("B","DRYING",100,List.of())),List.of());assertEquals("B",r.slots().get(0).resourceId());}
    @Test void unconvertibleUnitRefused(){assertThrows(RuntimeException.class,()->ProcessingScheduleService.kg(1,"箱"));assertEquals(500,ProcessingScheduleService.kg(1,"吨")/2);}
}
