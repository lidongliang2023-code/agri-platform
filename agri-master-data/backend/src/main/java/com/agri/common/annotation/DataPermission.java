package com.agri.common.annotation;

import java.lang.annotation.*;

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface DataPermission {

    String value() default "";

    String[] roles() default {};

    String[] permissions() default {};
}
