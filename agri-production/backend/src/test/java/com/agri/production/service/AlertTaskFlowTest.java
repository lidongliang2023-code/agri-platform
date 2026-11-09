package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.AlertRecord;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.AlertRuleMapper;
import com.agri.production.mapper.PlanStageMapper;
import com.agri.production.mapper.PlantingPlanMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.mapper.TaskRecordMapper;
import com.agri.production.mapper.TeamMemberMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.entity.Task;
import com.agri.production.service.impl.TaskServiceImpl;
import com.agri.production.service.impl.UserAlertServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AlertTaskFlowTest {

    @Test
    void alertCannotSkipFromPendingToHandled() {
        AlertRecordMapper alertMapper = mock(AlertRecordMapper.class);
        AlertRecord alert = new AlertRecord();
        alert.setAlertCode("AL-1");
        alert.setStatus("pending");
        when(alertMapper.selectOne(any())).thenReturn(alert);
        UserAlertServiceImpl service = ReflectionTestUtils.invokeMethod(UserAlertServiceImplFactory.class, "create", alertMapper);
        assertThrows(BusinessException.class, () -> service.handle("2001", "AL-1", 3, "跳过受理"));
        verify(alertMapper, never()).updateById(any(AlertRecord.class));
    }

    @Test
    void ignoredBatchRejectsHandledAlertsWithoutPartialUpdate() {
        AlertRecordMapper alertMapper = mock(AlertRecordMapper.class);
        AlertRecord alert = new AlertRecord();
        alert.setAlertCode("AL-2");
        alert.setStatus("handled");
        when(alertMapper.selectList(any())).thenReturn(List.of(alert));
        UserAlertServiceImpl service = ReflectionTestUtils.invokeMethod(UserAlertServiceImplFactory.class, "create", alertMapper);
        assertThrows(BusinessException.class, () -> service.ignore("2001", List.of("AL-2")));
        verify(alertMapper, never()).updateById(any(AlertRecord.class));
    }

    @Test
    void stageStaysOpenWhenTaskStatusCompletedButAcceptanceIsPending() {
        TaskMapper taskMapper = mock(TaskMapper.class);
        PlanStageMapper stageMapper = mock(PlanStageMapper.class);
        TaskServiceImpl service = new TaskServiceImpl(mock(TaskRecordMapper.class), mock(com.agri.production.mapper.TaskTemplateMapper.class), mock(TeamMemberMapper.class),
                mock(PlantingPlanMapper.class), stageMapper, mock(FarmIdResolver.class), mock(FarmMapper.class), mock(PlotMapper.class));
        ReflectionTestUtils.setField(service, "baseMapper", taskMapper);
        when(taskMapper.selectCount(any())).thenReturn(1L);
        Task task = new Task();
        task.setStageId(7L);
        task.setTenantId("2001");
        var stage = new com.agri.production.entity.PlanStage();
        when(stageMapper.selectById(7L)).thenReturn(stage);
        ReflectionTestUtils.invokeMethod(service, "syncStageOnAcceptance", task);
        verify(stageMapper).updateById(any(com.agri.production.entity.PlanStage.class));
        assertEquals(2, stage.getStatus());
    }
}

final class UserAlertServiceImplFactory {
    static UserAlertServiceImpl create(AlertRecordMapper mapper) {
        return new UserAlertServiceImpl(mapper, mock(FarmIdResolver.class), mock(AlertRuleMapper.class), mock(IProductionNotificationService.class));
    }
}
