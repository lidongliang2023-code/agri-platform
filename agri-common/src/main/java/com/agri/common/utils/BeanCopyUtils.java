package com.agri.common.utils;

import org.springframework.beans.BeanUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

public class BeanCopyUtils {

    public static <T> T copy(Object source, Class<T> targetClass) {
        if (source == null) {
            return null;
        }
        try {
            T target = targetClass.getDeclaredConstructor().newInstance();
            BeanUtils.copyProperties(source, target);
            return target;
        } catch (Exception e) {
            throw new RuntimeException("Bean copy failed", e);
        }
    }

    public static <T> T copy(Object source, Supplier<T> supplier) {
        if (source == null) {
            return null;
        }
        T target = supplier.get();
        BeanUtils.copyProperties(source, target);
        return target;
    }

    public static <T, S> List<T> copyList(List<S> sourceList, Class<T> targetClass) {
        if (sourceList == null || sourceList.isEmpty()) {
            return new ArrayList<>();
        }
        List<T> targetList = new ArrayList<>();
        for (S source : sourceList) {
            targetList.add(copy(source, targetClass));
        }
        return targetList;
    }

    public static <T, S> List<T> copyList(List<S> sourceList, Supplier<T> supplier) {
        if (sourceList == null || sourceList.isEmpty()) {
            return new ArrayList<>();
        }
        List<T> targetList = new ArrayList<>();
        for (S source : sourceList) {
            targetList.add(copy(source, supplier));
        }
        return targetList;
    }

    public static void copyProperties(Object source, Object target) {
        BeanUtils.copyProperties(source, target);
    }
}
