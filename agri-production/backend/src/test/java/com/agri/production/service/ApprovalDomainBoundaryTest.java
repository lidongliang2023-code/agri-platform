package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.mapper.ApprovalMapper;
import com.agri.production.mapper.ApprovalFlowMapper;
import com.agri.production.service.impl.AdminApprovalServiceImpl;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** 旧审批不得产生假成功，或绕过主体计划审批修改业务。 */
class ApprovalDomainBoundaryTest {
    @Test void legacyDecisionsAndConfigurationCannotWriteAnything() {
        ApprovalMapper approvals = mock(ApprovalMapper.class);
        ApprovalFlowMapper flows = mock(ApprovalFlowMapper.class);
        var service = new AdminApprovalServiceImpl(approvals, flows);
        List<org.junit.jupiter.api.function.Executable> writes = List.of(
            () -> service.approve("PLAN-001", "通过"),
            () -> service.reject("CERT-001", "驳回"),
            () -> service.batchApprove(List.of("PLAN-001", "QUOTA-001"), "通过"),
            () -> service.createFlow(Map.of("flowName", "流程")),
            () -> service.updateFlow("FLOW-001", Map.of("status", 1)),
            () -> service.deleteFlow("FLOW-001")
        );
        for (var write : writes) {
            var failure = assertThrows(BusinessException.class, write);
            assertEquals(410, failure.getCode());
            assertTrue(failure.getMessage().contains("用户中心"));
        }
        verifyNoInteractions(approvals, flows);
    }
}
