package com.agri.finance.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("供应链金融模块API文档")
                        .version("1.0.0")
                        .description("农业产业互联网平台供应链金融模块接口文档")
                        .contact(new Contact()
                                .name("技术支持")
                                .email("support@agri-platform.com")));
    }
}