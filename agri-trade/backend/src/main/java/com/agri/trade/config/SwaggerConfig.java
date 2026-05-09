package com.agri.trade.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("农业产业互联网平台 - 交易撮合模块 API")
                        .version("1.0.0")
                        .description("交易撮合模块独立服务API文档，包含订单管理、商品管理、需求发布、智能匹配、合同管理、物流跟踪、信用评价等功能")
                        .contact(new Contact()
                                .name("Agri Platform Team")
                                .email("support@agri-platform.com"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")));
    }
}