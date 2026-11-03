<template>
  <div class="m-container" v-loading="loading">
    <!-- 顶部：搜索 + 全部商品入口 -->
    <div class="m-page-hd lead">
      <h1>商品分类</h1>
      <span class="sub">共 {{ firstLevel.length }} 个一级分类 · {{ subCount }} 个二级分类</span>
      <div class="hd-actions">
        <el-input
          v-model="keyword"
          class="hd-search"
          placeholder="搜索商品，如「有机大米」"
          clearable
          @keyup.enter="goSearch"
        />
        <button type="button" class="m-btn" @click="goSearch">搜索</button>
        <button type="button" class="m-btn primary" @click="router.push('/products')">全部商品</button>
      </div>
    </div>

    <div v-if="firstLevel.length" class="cat-layout">
      <!-- 一级分类竖列 -->
      <aside class="m-card cat-rail">
        <button
          v-for="cat in firstLevel"
          :key="cat.id"
          type="button"
          class="rail-item"
          :class="{ on: String(cat.id) === String(activeId) }"
          @click="selectCategory(cat.id)"
        >
          <span class="ico">{{ cat.icon || '🌿' }}</span>
          <span class="name">{{ cat.name }}</span>
          <span class="cnt muted small">{{ (cat.children || []).length }}</span>
        </button>
      </aside>

      <section class="cat-main m-stack">
        <!-- 二级分类 -->
        <div class="m-card">
          <div class="m-card-hd">
            <h3>{{ activeCat?.name || '分类' }}</h3>
            <span class="muted small">{{ subCategories.length }} 个二级分类</span>
            <div class="hd-actions">
              <button type="button" class="m-btn sm ghost" @click="goList(activeId)">
                查看该分类全部商品 ›
              </button>
            </div>
          </div>

          <div class="m-card-pad">
            <div v-if="subCategories.length" class="m-grid m-grid-4">
              <button
                v-for="sub in subCategories"
                :key="sub.id"
                type="button"
                class="sub-item"
                @click="goList(sub.id)"
              >
                <span class="sub-ico">{{ sub.icon || '🌿' }}</span>
                <b>{{ sub.name }}</b>
                <small>{{ sub.children?.length ? `${sub.children.length} 个子类` : '产地直供' }}</small>
              </button>
            </div>
            <EmptyBlock
              v-else
              icon="🗂️"
              title="该分类暂无二级分类"
              desc="二级分类由平台运营端在分类管理中维护。未配置子类时该分类下仍可能有商品，可直接查看该分类商品。"
            >
              <template #actions>
                <button type="button" class="m-btn ghost" @click="goList(activeId)">查看该分类商品</button>
              </template>
            </EmptyBlock>
          </div>
        </div>

        <!-- 当前分类热销 -->
        <div>
          <SectionHead
            title="本类热销"
            :desc="activeCat ? `按累计销量展示「${activeCat.name}」下的在架商品` : '按累计销量展示在架商品'"
            more-text="更多 ›"
            @more="goList(activeId)"
          />
          <div v-if="hotProducts.length" class="m-grid m-grid-4">
            <ProductCard
              v-for="p in hotProducts"
              :key="p.id"
              :product="p"
              :favorited="favorites.has(p.id)"
              @favorite="favorites.toggle(p.id)"
              @add="addToCart(p)"
            />
          </div>
          <EmptyBlock
            v-else-if="!hotLoading"
            icon="🌾"
            title="该分类暂无在架商品"
            desc="商品由供应商在供应商端上架、经平台审核通过后才会出现在这里，审核前不展示。"
          >
            <template #actions>
              <button type="button" class="m-btn ghost" @click="router.push('/products')">看看全部商品</button>
            </template>
          </EmptyBlock>
        </div>
      </section>
    </div>

    <EmptyBlock
      v-else-if="!loading"
      icon="🗂️"
      title="暂无分类数据"
      desc="分类树由平台运营端维护。当前接口没有返回任何分类，因此无法按分类浏览，可先进入全部商品列表。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/products')">查看全部商品</button>
      </template>
    </EmptyBlock>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { useFavorites } from '../composables/useFavorites'
import SectionHead from '../components/SectionHead.vue'
import ProductCard from '../components/ProductCard.vue'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()
const favorites = useFavorites()

const loading = ref(false)
const hotLoading = ref(false)
const keyword = ref('')
const activeId = ref(null)
const hotProducts = ref([])

const firstLevel = computed(() => userStore.categories || [])
const activeCat = computed(
  () => firstLevel.value.find((cat) => String(cat.id) === String(activeId.value)) || null,
)
const subCategories = computed(() => activeCat.value?.children || [])
const subCount = computed(() =>
  firstLevel.value.reduce((sum, cat) => sum + (cat.children?.length || 0), 0),
)

async function load() {
  loading.value = true
  try {
    // 分类树统一走 store 缓存，避免各页面各拉一份
    const tree = await userStore.loadCategories(true)
    if (!activeId.value && tree?.length) activeId.value = tree[0].id
    await favorites.load()
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '分类加载失败')
  } finally {
    loading.value = false
  }
  if (activeId.value) await loadHot()
}

async function loadHot() {
  hotLoading.value = true
  try {
    const page = await consumerApi.getProducts({ categoryId: activeId.value, page: 1, size: 8 })
    hotProducts.value = (page?.records || []).slice(0, 4)
  } catch (err) {
    hotProducts.value = []
    ElMessage.error(err.friendlyMessage || '热销商品加载失败')
  } finally {
    hotLoading.value = false
  }
}

function selectCategory(id) {
  if (String(id) === String(activeId.value)) return
  activeId.value = id
  loadHot()
}

function goList(categoryId) {
  router.push({ path: '/products', query: categoryId ? { categoryId } : {} })
}

function goSearch() {
  const q = keyword.value.trim()
  if (!q) {
    ElMessage.warning('请输入要搜索的商品关键词')
    return
  }
  router.push({ path: '/search', query: { q } })
}

async function addToCart(product) {
  if (!userStore.consumerId) {
    ElMessage.warning('请先完成登录')
    return
  }
  try {
    const res = await consumerApi.addCart({
      consumerId: userStore.consumerId,
      productId: product.id,
      quantity: 1,
    })
    if (res?.success === false) {
      ElMessage.warning(res.message || '加入购物车失败')
      return
    }
    await userStore.refreshCart()
    ElMessage.success('已加入购物车')
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '加入购物车失败')
  }
}

onMounted(load)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 0 auto;
}

.lead {
  margin-top: 18px;
}

.hd-search {
  width: 240px;
}

.cat-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.cat-rail {
  display: grid;
  overflow: hidden;
  padding: 6px 0;
}

.rail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border: 0;
  border-left: 3px solid transparent;
  background: #fff;
  color: #33453b;
  font-size: 13.5px;
  text-align: left;
  cursor: pointer;
}

.rail-item:hover {
  background: #f8fbf9;
  color: #12764a;
}

.rail-item.on {
  border-left-color: #12764a;
  background: #f1fbf5;
  color: #12764a;
  font-weight: 700;
}

.rail-item .ico {
  font-size: 15px;
}

.rail-item .name {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rail-item .cnt {
  font-variant-numeric: tabular-nums;
}

.sub-item {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 16px 10px;
  border: 1px solid #e3eae5;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: border-color .15s, transform .15s, background .15s;
}

.sub-item:hover {
  transform: translateY(-2px);
  border-color: #bfe0cd;
  background: #fbfdfc;
}

.sub-item .sub-ico {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #f1fbf5;
  font-size: 19px;
}

.sub-item b {
  font-size: 13px;
  font-weight: 600;
}

.sub-item small {
  color: #93a29a;
  font-size: var(--agri-font-size-micro);
}

@media (max-width: 1080px) {
  .cat-layout { grid-template-columns: minmax(0, 1fr); }
  .cat-rail { grid-auto-flow: column; overflow-x: auto; padding: 0; }
  .rail-item { width: auto; border-left: 0; border-bottom: 3px solid transparent; }
  .rail-item.on { border-bottom-color: #12764a; }
}
</style>
