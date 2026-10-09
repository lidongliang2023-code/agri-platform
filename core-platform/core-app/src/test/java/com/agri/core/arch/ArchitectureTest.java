package com.agri.core.arch;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.CompositeArchRule;

import java.util.ArrayList;
import java.util.List;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * CI 门禁（ADR-001 纪律 4：边界靠机器守，不靠自觉）：
 * 1) 模块间禁止触达对方 internal 包 —— 仅允许经对方 api 包通信；
 * 2) 模块禁止依赖 core-app 部署单元；
 * 3) 共享内核保持零业务语义、零框架依赖。
 */
@AnalyzeClasses(packages = "com.agri", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final List<String> MODS = List.of("platform", "trade", "produce", "service");

    private static final DescribedPredicate<JavaClass> IN_CORE_APP = new DescribedPredicate<>("reside in core-app") {
        @Override
        public boolean test(JavaClass clazz) {
            String pkg = clazz.getPackageName();
            if (pkg.equals("com.agri.core")) {
                return true;
            }
            return pkg.startsWith("com.agri.core.") && !pkg.startsWith("com.agri.core.infra");
        }
    };

    private static ArchRule pair(String source, String target) {
        return noClasses().that().resideInAPackage("com.agri." + source + "..")
                .should().dependOnClassesThat().resideInAPackage("com.agri." + target + ".internal..")
                .allowEmptyShould(true)
                .because("模块间仅允许经对方 api 包通信（ADR-001 纪律 1）");
    }

    private static final ArchRule NO_CROSS_MODULE_INTERNALS = buildCrossModuleRule();

    private static ArchRule buildCrossModuleRule() {
        List<ArchRule> rules = new ArrayList<>();
        for (String a : MODS) {
            for (String b : MODS) {
                if (!a.equals(b)) {
                    rules.add(pair(a, b));
                }
            }
        }
        return CompositeArchRule.of(rules);
    }

    @ArchTest
    static final ArchRule noCrossModuleInternalAccess = NO_CROSS_MODULE_INTERNALS;

    @ArchTest
    static final ArchRule modsMustNotDependOnCoreApp = noClasses()
            .that().resideInAnyPackage("com.agri.platform..", "com.agri.trade..", "com.agri.produce..", "com.agri.service..")
            .should().dependOnClassesThat(IN_CORE_APP)
            .allowEmptyShould(true)
            .because("模块不得反向依赖部署单元");

    @ArchTest
    static final ArchRule sharedKernelMustStayPure = noClasses()
            .that().resideInAPackage("com.agri.shared..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "com.baomidou..", "jakarta..", "org.apache..",
                    "io.jsonwebtoken..", "org.flywaydb..",
                    "com.agri.core..", "com.agri.platform..", "com.agri.trade..",
                    "com.agri.produce..", "com.agri.service..")
            .allowEmptyShould(true)
            .because("共享内核仅无业务语义的工具与公共 VO（图 2）");
}
