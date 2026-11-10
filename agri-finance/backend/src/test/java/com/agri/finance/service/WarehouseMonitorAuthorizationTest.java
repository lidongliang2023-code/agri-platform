package com.agri.finance.service;

import com.agri.common.exception.BusinessException;
import com.agri.finance.entity.*;
import com.agri.finance.mapper.*;
import com.agri.finance.service.impl.AssetServiceImpl;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.*;
import java.math.BigDecimal;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class WarehouseMonitorAuthorizationTest {
    WarehouseReceiptMapper receipts=mock(WarehouseReceiptMapper.class);
    PledgeMapper pledges=mock(PledgeMapper.class);
    LoanApplicationMapper apps=mock(LoanApplicationMapper.class);
    LoanMapper loans=mock(LoanMapper.class);
    WarehouseMonitorAccessMapper access=mock(WarehouseMonitorAccessMapper.class);
    FinanceIdentityService identity=mock(FinanceIdentityService.class);
    WarehouseMonitorAuthorization auth;
    WarehouseReceipt receipt;
    Pledge pledge;
    LoanApplication app;
    MockHttpServletRequest request;
    @BeforeEach void setup() {
        // 静态授权头读取使用真实服务对象，业务权限和归属用 mock 明确控制。
        new FinanceIdentityService(mock(FundProviderMapper.class),mock(com.agri.common.rbac.PermissionResolver.class),"http://unused");
        request=new MockHttpServletRequest(); request.addHeader("Authorization","Bearer tested");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        auth=new WarehouseMonitorAuthorization(receipts,pledges,apps,loans,access,identity);
        receipt=new WarehouseReceipt(); receipt.setId("R1");receipt.setUserId("2001");receipt.setDelFlag(0);
        receipt.setBatchId("101");receipt.setBatchNo("B101");receipt.setPledgeId("P1");receipt.setStatus("已质押");
        pledge=new Pledge();pledge.setId("P1");pledge.setReceiptId("R1");pledge.setUserId("2001");
        pledge.setDelFlag(0);pledge.setStatus("已生效");pledge.setApplicationId("APP1");
        app=new LoanApplication();app.setId("APP1");app.setUserId("2001");app.setStatus("已通过");app.setDelFlag(0);
        when(receipts.selectById("R1")).thenReturn(receipt);when(pledges.selectById("P1")).thenReturn(pledge);
        when(apps.selectById("APP1")).thenReturn(app);when(identity.hasPermission("finance:read")).thenReturn(true);
        when(identity.hasPermission("finance:fund")).thenReturn(true);when(identity.currentProviderId()).thenReturn("BANK1");
        when(identity.currentBorrowerId()).thenReturn("9001");
        when(access.activeFunding("BANK1",AssetServiceImpl.approvedApplicationAssetId("APP1"),"2001")).thenReturn(1L);
    }
    @AfterEach void cleanup(){RequestContextHolder.resetRequestAttributes();}
    void denied(){assertEquals(403,assertThrows(BusinessException.class,()->auth.require("R1")).getCode());}
    @Test void anonymousDenied(){request.removeHeader("Authorization");assertEquals(401,assertThrows(BusinessException.class,()->auth.require("R1")).getCode());verifyNoInteractions(receipts);}
    @Test void invalidPermissionsDenied(){when(identity.hasPermission("finance:read")).thenReturn(false);denied();verifyNoInteractions(receipts);}
    @Test void ownBorrowerAllowed(){when(identity.hasPermission("finance:borrower")).thenReturn(true);when(identity.currentBorrowerId()).thenReturn("2001");assertSame(receipt,auth.require("R1"));verifyNoInteractions(access);}
    @Test void otherBorrowerDenied(){when(identity.hasPermission("finance:fund")).thenReturn(false);denied();}
    @Test void effectiveInvestorAllowed(){assertEquals("2001",auth.scope("R1").get("tenantId"));}
    @Test void wrongInstitutionDenied(){when(identity.currentProviderId()).thenReturn("BANK2");denied();}
    @Test void noInvestmentDenied(){when(access.activeFunding(anyString(),anyString(),anyString())).thenReturn(0L);denied();}
    @Test void releasedReceiptDenied(){receipt.setStatus("已释放");denied();}
    @Test void releasedPledgeDenied(){pledge.setStatus("已释放");denied();}
    @Test void unrelatedReceiptDenied(){pledge.setReceiptId("R2");denied();}
    @Test void mismatchedApplicationOwnerDenied(){app.setUserId("2003");denied();}
    @Test void rejectedApplicationDenied(){app.setStatus("已拒绝");denied();}
    @Test void settledLoanDenied(){pledge.setLoanId("L1");Loan l=new Loan();l.setId("L1");l.setUserId("2001");l.setApplicationId("APP1");l.setDelFlag(0);l.setStatus("已结清");when(loans.selectById("L1")).thenReturn(l);denied();}
    @Test void missingReceiptNotFound(){assertEquals(404,assertThrows(BusinessException.class,()->auth.require("missing")).getCode());}
    @Test void reviewerWithoutInvestmentDenied(){when(identity.isOperator()).thenReturn(true);when(access.activeFunding(anyString(),anyString(),anyString())).thenReturn(0L);denied();}
    @Test void operatorAllowed(){when(identity.hasPermission("finance:admin")).thenReturn(true);assertSame(receipt,auth.require("R1"));}
}
