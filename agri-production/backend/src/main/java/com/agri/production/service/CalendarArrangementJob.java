package com.agri.production.service;

import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.time.LocalDate;

/** 服务业务调度，不向外发送指令。跨月确认和下发仍由人工完成。 */
@Component
public class CalendarArrangementJob {
    private static final Logger log=LoggerFactory.getLogger(CalendarArrangementJob.class);
    private final JdbcTemplate db;private final CalendarArrangementService service;
    public CalendarArrangementJob(JdbcTemplate db,CalendarArrangementService service) {this.db=db;this.service=service;}
    @Scheduled(cron="0 0 6 * * *",zone="Asia/Shanghai")
    public void daily() {
        for(var row:db.queryForList("SELECT id,tenant_id FROM agri_prod_calendar_arrangement WHERE status='DRAFT' AND week_start>=?",LocalDate.now().minusDays(6))) {
            try {service.refreshDraftFromJob(String.valueOf(row.get("tenant_id")),String.valueOf(row.get("id")));}
            catch(Exception e) {log.warn("农事草稿自动重排未完成 id={}",row.get("id"));}
        }
        for(var row:db.queryForList("SELECT DISTINCT tenant_id,farm_id FROM agri_prod_calendar_arrangement WHERE status='PUBLISHED'")) {
            try {service.scanInterventions(String.valueOf(row.get("tenant_id")),((Number)row.get("farm_id")).longValue());}
            catch(Exception e) {log.warn("农事连续未完成扫描失败 farm={}",row.get("farm_id"));}
        }
    }
}
