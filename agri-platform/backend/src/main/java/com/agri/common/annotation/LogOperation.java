package com.agri.common.annotation;

import java.lang.annotation.*;

@Target({ElementType.PARAMETER, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface LogOperation {

    String value() default "";

    String module() default "";

    String content() default "";

    LogType type() default LogType.OTHER;

    enum LogType {
        OTHER,
        QUERY,
        INSERT,
        UPDATE,
        DELETE,
        EXPORT,
        IMPORT
    }
}
