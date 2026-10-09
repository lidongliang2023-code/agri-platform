package com.agri.platform.internal.auth;

import com.agri.platform.internal.market.MarketEntity;
import com.agri.platform.internal.market.MarketMapper;
import com.agri.platform.internal.product.CategoryEntity;
import com.agri.platform.internal.product.CategoryMapper;
import com.agri.platform.internal.product.ProductEntity;
import com.agri.platform.internal.product.ProductMapper;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.permission.RoleEntity;
import com.agri.platform.internal.permission.RoleMapper;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.platform.internal.user.UserRoleEntity;
import com.agri.platform.internal.user.UserRoleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 首启引导：创建管理员账号与「用户×角色×市场」绑定（角色/市场/商品等基础种子由 Flyway V1 迁移负责）。
 * 生产环境请立即修改默认口令（环境变量 AGRI_ADMIN_PASSWORD）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminUserInitializer implements CommandLineRunner {

    private final UserMapper userMapper;
    private final RoleMapper roleMapper;
    private final UserRoleMapper userRoleMapper;
    private final MarketMapper marketMapper;
    private final CategoryMapper categoryMapper;
    private final MerchantMapper merchantMapper;
    private final ProductMapper productMapper;

    @Override
    public void run(String... args) {
        if (userMapper.selectCount(null) > 0) {
            return;
        }
        String password = System.getenv().getOrDefault("AGRI_ADMIN_PASSWORD", "Admin@123");
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

        if (roleMapper.selectCount(null) == 0) {
            RoleEntity admin = new RoleEntity();
            admin.setCode("SUPER_ADMIN");
            admin.setName("超级管理员");
            admin.setPermissions("[\"*\"]");
            roleMapper.insert(admin);

            RoleEntity ops = new RoleEntity();
            ops.setCode("MARKET_OPS");
            ops.setName("市场运营");
            ops.setPermissions("[\"trade:read\",\"trade:write\",\"produce:read\",\"produce:write\",\"quote:read\",\"quote:write\"]");
            roleMapper.insert(ops);
        }

        if (marketMapper.selectCount(null) == 0) {
            seedMarket("M-HN", "华南农产品中心市场");
            seedMarket("M-HD", "华东农产品中心市场");
            seedMarket("M-XB", "西北农产品产地市场");
        }

        UserEntity admin = new UserEntity();
        admin.setUsername("admin");
        admin.setPassword(encoder.encode(password));
        admin.setNickname("平台管理员");
        admin.setStatus(1);
        userMapper.insert(admin);

        for (RoleEntity role : roleMapper.selectList(null)) {
            if (!"SUPER_ADMIN".equals(role.getCode())) {
                continue;
            }
            for (MarketEntity market : marketMapper.selectList(null)) {
                UserRoleEntity binding = new UserRoleEntity();
                binding.setUserId(admin.getId());
                binding.setRoleId(role.getId());
                binding.setMarketId(market.getId());
                userRoleMapper.insert(binding);
            }
        }

        if (categoryMapper.selectCount(null) == 0) {
            CategoryEntity fruit = new CategoryEntity();
            fruit.setParentId(0L);
            fruit.setCode("C-FRUIT");
            fruit.setName("水果");
            fruit.setLevel(1);
            categoryMapper.insert(fruit);

            CategoryEntity vegetable = new CategoryEntity();
            vegetable.setParentId(0L);
            vegetable.setCode("C-VEG");
            vegetable.setName("蔬菜");
            vegetable.setLevel(1);
            categoryMapper.insert(vegetable);
        }

        if (merchantMapper.selectCount(null) == 0) {
            MerchantEntity merchant = new MerchantEntity();
            merchant.setCode("M20260001");
            merchant.setName("绿源农业合作社");
            merchant.setType("BOTH");
            merchant.setCreditCode("91440300MA5XXXXX0X");
            merchant.setContactName("李绿源");
            merchant.setContactPhone("13800000000");
            merchant.setStatus(1);
            merchantMapper.insert(merchant);
        }

        if (productMapper.selectCount(null) == 0) {
            ProductEntity product = new ProductEntity();
            product.setCategoryId(categoryMapper.selectOne(new LambdaQueryWrapper<CategoryEntity>()
                    .eq(CategoryEntity::getCode, "C-FRUIT")).getId());
            product.setMerchantId(merchantMapper.selectList(null).get(0).getId());
            product.setCode("P20260001");
            product.setName("红富士苹果");
            product.setSpec("一级 80#");
            product.setUnit("kg");
            product.setPrice(new java.math.BigDecimal("6.50"));
            product.setStock(new java.math.BigDecimal("10000"));
            product.setStatus(1);
            productMapper.insert(product);
        }

        log.info("首启引导完成：已创建 admin 账号、角色、市场、类目、客商与示例商品");
    }

    private void seedMarket(String code, String name) {
        MarketEntity market = new MarketEntity();
        market.setCode(code);
        market.setName(name);
        market.setStatus(1);
        marketMapper.insert(market);
    }
}
