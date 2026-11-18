package com.agri.government.security;

import com.agri.common.rbac.*;
import com.agri.government.common.security.*;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.*;
import org.springframework.http.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** 使用真实权限解析器、真实拦截器和可控平台响应，不使用业务数据库或真实令牌。 */
class GovernmentAuthenticationStatusTest {
    MockRestServiceServer platform;
    MockMvc mvc;
    Probe controller;
    @BeforeEach void setup() {
        var rest = new RestTemplate();
        platform = MockRestServiceServer.bindTo(rest).build();
        var resolver = new PlatformPermissionResolver(rest, "http://platform.test");
        var properties = new RbacProperties();
        properties.setRequireAuth(true);
        controller = new Probe();
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .addInterceptors(new OperatorGuardInterceptor(resolver, properties)).build();
    }
    @RestController
    @OperatorOnly("gov:inspector")
    static class Probe {
        final AtomicInteger calls = new AtomicInteger();
        @RequestMapping(value="/probe", method={RequestMethod.GET,RequestMethod.POST})
        public String invoke() { calls.incrementAndGet(); return "ok"; }
    }
    void expectPlatform(HttpStatus status, String body) {
        platform.expect(requestTo("http://platform.test/api/v1/platform/permissions/mine"))
                .andExpect(header("Authorization", "Bearer test-token"))
                .andRespond(withStatus(status).contentType(MediaType.APPLICATION_JSON).body(body));
    }
    @Test void missingCredentialIs401() throws Exception {
        mvc.perform(get("/probe")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
        assertEquals(0, controller.calls.get()); platform.verify();
    }
    @Test void revokedOrExpiredCredentialIs401ForReads() throws Exception {
        expectPlatform(HttpStatus.UNAUTHORIZED, "{\"code\":401}");
        mvc.perform(get("/probe").header("Authorization","Bearer test-token"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
        assertEquals(0,controller.calls.get()); platform.verify();
    }
    @Test void revokedOrExpiredCredentialIs401ForWrites() throws Exception {
        expectPlatform(HttpStatus.UNAUTHORIZED, "{\"code\":401}");
        mvc.perform(post("/probe").header("Authorization","Bearer test-token"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value(401));
        assertEquals(0,controller.calls.get()); platform.verify();
    }
    @Test void authenticatedButWrongRoleRemains403() throws Exception {
        expectPlatform(HttpStatus.OK, "{\"code\":0,\"data\":{\"permissions\":[\"gov:citizen\"]}}");
        mvc.perform(get("/probe").header("Authorization","Bearer test-token"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value(403));
        assertEquals(0,controller.calls.get()); platform.verify();
    }
    @Test void authenticatedInspectorStillAllowed() throws Exception {
        expectPlatform(HttpStatus.OK, "{\"code\":0,\"data\":{\"permissions\":[\"gov:inspector\"]}}");
        mvc.perform(get("/probe").header("Authorization","Bearer test-token")).andExpect(status().isOk());
        assertEquals(1,controller.calls.get()); platform.verify();
    }
    void capabilityResponse(int upstream, String body, int expected) throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/check", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders(upstream,bytes.length);
            try(var out=exchange.getResponseBody()){out.write(bytes);}
        });
        server.start();
        try {
            var guard = new CapabilityGuard();
            ReflectionTestUtils.setField(guard,"checkUrl","http://127.0.0.1:"+server.getAddress().getPort()+"/check");
            ReflectionTestUtils.setField(guard,"internalToken","test-internal-token");
            var capabilityMvc = MockMvcBuilders.standaloneSetup(controller)
                    .addInterceptors(new GovernmentCapabilityInterceptor(guard)).build();
            capabilityMvc.perform(post("/probe").header("Authorization","Bearer test-token"))
                    .andExpect(status().is(expected)).andExpect(jsonPath("$.code").value(expected));
            assertEquals(0,controller.calls.get());
        } finally {server.stop(0);}
    }
    @Test void capabilityRejectsInvalidCredentialWith401() throws Exception {
        capabilityResponse(401,"{\"code\":401}",401);
    }
    @Test void capabilityBusinessDenialRemains403() throws Exception {
        capabilityResponse(200,"{\"code\":0,\"data\":{\"granted\":false,\"reason\":\"permission denied\"}}",403);
    }
    @Test void capabilityServiceFailureRemains503() throws Exception {
        capabilityResponse(500,"{}",503);
    }
}
