package com.agri.produce.internal.admin;

import com.agri.shared.exception.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ApprovalDomainBoundaryTest {
    @Test void legacyCoreCannotBypassDomainApprovalRules() {
        ApprovalMapper mapper = mock(ApprovalMapper.class);
        ApprovalService service = new ApprovalService(mapper);
        List<org.junit.jupiter.api.function.Executable> writes = List.of(
            () -> service.create(new ApprovalEntity()),
            () -> service.update("APPR-001", new ApprovalEntity()),
            () -> service.delete("APPR-001"),
            () -> service.approve("APPR-001", "forged-user", "通过"),
            () -> service.reject("APPR-001", "forged-user", "驳回")
        );
        for (var write : writes) assertThrows(BusinessException.class, write);
        assertTrue(service.config().isEmpty());
        verifyNoInteractions(mapper);
    }
}
