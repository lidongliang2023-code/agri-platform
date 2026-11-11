package com.agri.core.masterdata;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 主数据中心到核心平台的内部接收端。 */
@RestController
@RequestMapping("/internal/master-data")
@RequiredArgsConstructor
public class MasterDataReceiveController {
    private final MasterDataReceiveService service;

    @Value("${agri.master-data.receive.internal-token:dev-internal-token}")
    private String internalToken;

    @PostMapping("/receive")
    public ApiResponse<MasterDataReceiveService.ReceiveAck> receive(
            @RequestHeader(value = "X-Internal-Token", required = false) String givenToken,
            @RequestBody MasterDataReceiveService.ReceiveRequest request) {
        if (internalToken == null || !internalToken.equals(givenToken)) throw new BusinessException(ErrorCode.FORBIDDEN);
        return ApiResponse.ok(service.receive(request));
    }
}
