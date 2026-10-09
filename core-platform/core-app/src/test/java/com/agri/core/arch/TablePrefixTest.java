package com.agri.core.arch;

import com.baomidou.mybatisplus.annotation.TableName;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

/**
 * CI 门禁：表归属前缀校验（ADR-001 纪律 2）。
 * 每张表属于唯一模块：platform → platform_，trade → trade_，produce → prod_，service → svc_。
 * 表前缀物理隔离使跨模块 JOIN 难以发生。
 */
@AnalyzeClasses(packages = "com.agri", importOptions = ImportOption.DoNotIncludeTests.class)
class TablePrefixTest {

    @ArchTest
    static final ArchRule entitiesMustUseModuleTablePrefix = classes()
            .that().areAnnotatedWith(TableName.class)
            .should(new ArchCondition<>("使用所属模块的表前缀") {
                @Override
                public void check(JavaClass clazz, ConditionEvents events) {
                    String table = clazz.getAnnotationOfType(TableName.class).value();
                    String pkg = clazz.getPackageName();
                    String expected = expectedPrefix(pkg);
                    if (expected == null) {
                        return;
                    }
                    if (!table.startsWith(expected)) {
                        events.add(SimpleConditionEvent.violated(clazz,
                                String.format("%s 表名 %s 必须以 %s 开头（包 %s）",
                                        clazz.getName(), table, expected, pkg)));
                    }
                }
            });

    private static String expectedPrefix(String pkg) {
        if (pkg.startsWith("com.agri.platform.")) {
            return "platform_";
        }
        if (pkg.startsWith("com.agri.trade.")) {
            return "trade_";
        }
        if (pkg.startsWith("com.agri.produce.")) {
            return "prod_";
        }
        if (pkg.startsWith("com.agri.service.")) {
            return "svc_";
        }
        // core-infra 承载平台域语义的基础设施表（本地消息表 / 消费幂等）
        if (pkg.startsWith("com.agri.core.infra.")) {
            return "platform_";
        }
        return null;
    }
}
