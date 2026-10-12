package com.agri.common.aspect;

import com.agri.common.annotation.DataPermission;
import com.agri.common.security.SecurityUtils;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.stereotype.Component;

import java.util.Set;

@Slf4j
@Aspect
@Component
public class DataScopeAspect {

    @Pointcut("@annotation(com.agri.common.annotation.DataPermission)")
    public void dataScopePointcut() {
    }

    @Before("dataScopePointcut()")
    public void before() {
        DataPermission annotation = getAnnotation();
        if (annotation == null) {
            return;
        }

        String[] roles = annotation.roles();
        String[] permissions = annotation.permissions();

        if (roles.length > 0) {
            Set<String> userRoles = SecurityUtils.getRoles();
            boolean hasRole = false;
            for (String role : roles) {
                if (userRoles.contains(role)) {
                    hasRole = true;
                    break;
                }
            }
            if (!hasRole) {
                log.warn("User does not have required roles: {}", String.join(",", roles));
            }
        }

        if (permissions.length > 0) {
            Set<String> userPermissions = SecurityUtils.getPermissions();
            boolean hasPermission = false;
            for (String permission : permissions) {
                if (userPermissions.contains(permission)) {
                    hasPermission = true;
                    break;
                }
            }
            if (!hasPermission) {
                log.warn("User does not have required permissions: {}", String.join(",", permissions));
            }
        }
    }

    private DataPermission getAnnotation() {
        return null;
    }
}
