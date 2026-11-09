package com.agri.iot.repository;

import com.agri.iot.common.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class UploadFormatTest {
    MockMvc mvc;
    @RestController
    static class UploadEndpoint {
        @PostMapping(value="/upload", consumes="multipart/form-data")
        String upload(@RequestParam("file") MultipartFile file) { return "ok"; }
        @PostMapping("/broken")
        String broken() { throw new MultipartException("private parser detail"); }
        @PostMapping("/large")
        String large() { throw new MaxUploadSizeExceededException(256L*1024*1024); }
    }
    @BeforeEach void setup() {
        mvc=MockMvcBuilders.standaloneSetup(new UploadEndpoint())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @Test void jsonUploadReturns415() throws Exception {
        mvc.perform(post("/upload").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnsupportedMediaType()).andExpect(jsonPath("$.code").value(415))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("multipart/form-data")));
    }
    @Test void missingFileReturns400() throws Exception {
        mvc.perform(multipart("/upload"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("file")));
    }
    @Test void wrongFieldReturns400() throws Exception {
        mvc.perform(multipart("/upload").file(new MockMultipartFile("wrong", "test.bin", "application/octet-stream", new byte[]{1})))
                .andExpect(status().isBadRequest());
    }
    @Test void malformedUploadReturnsSafe400() throws Exception {
        mvc.perform(post("/broken")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("上传内容格式不正确或不完整，请重新选择文件后上传"));
    }
    @Test void tooLargeStillReturns413() throws Exception {
        mvc.perform(post("/large")).andExpect(status().isPayloadTooLarge()).andExpect(jsonPath("$.code").value(413));
    }
    @Test void validMultipartStillReachesEndpoint() throws Exception {
        mvc.perform(multipart("/upload").file(new MockMultipartFile("file", "test.bin", "application/octet-stream", new byte[]{1})))
                .andExpect(status().isOk()).andExpect(content().string("ok"));
    }
}
