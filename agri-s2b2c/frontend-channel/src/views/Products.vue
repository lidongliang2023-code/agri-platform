<template>
  <div class="products-page">
    <div class="page-head">
      <div>
        <h2>{{ isEditPage ? '商品编辑' : '我的货架' }}</h2>
        <p>管理已选商品的分销价与货架状态；商品标题、图片与供货价归交易撮合，本页只维护渠道层信息。</p>
      </div>
      <el-button @click="$router.push('/product-pool')">去选品中心</el-button>
    </div>

    <div class="filter-bar">
      <el-button @click="loadProducts">刷新货架</el-button>
    </div>

    <el-table :data="products" border>
      <el-table-column prop="name" label="商品名称" min-width="200" />
      <el-table-column prop="categoryName" label="分类" width="120" />
      <el-table-column label="供货价" width="110">
        <template #default="{ row }">¥{{ money(row.price) }}</template>
      </el-table-column>
      <el-table-column label="渠道零售价" width="140">
        <template #default="{ row }">
          <b v-if="row.retailPrice">¥{{ money(row.retailPrice) }}</b>
          <span v-else class="muted">未设置（¥{{ money(row.price) }}）</span>
        </template>
      </el-table-column>
      <el-table-column label="佣金比例" width="100">
        <template #default="{ row }">{{ Number(row.commissionRate) }}%</template>
      </el-table-column>
      <el-table-column prop="sales" label="销量" width="90" />
      <el-table-column prop="stock" label="库存" width="90" />
      <el-table-column label="货架" width="100">
        <template #default="{ row }">
          <el-tag :type="isOn(row) ? 'success' : 'info'">{{ isOn(row) ? '在售' : '已下架' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">改价</el-button>
          <el-button v-if="isOn(row)" link type="warning" @click="toggleShelf(row, 'OFF')">下架</el-button>
          <el-button v-else link type="success" @click="toggleShelf(row, 'ON')">上架</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="!products.length" description="货架为空，先去平台商品池选品" />
    <el-pagination
      @current-change="handlePageChange"
      :current-page="page"
      :page-size="size"
      :total="total"
      layout="prev, pager, next, jumper"
    />

    <el-dialog v-model="editVisible" title="渠道改价" width="460px">
      <el-form label-width="110px">
        <el-form-item label="商品"><span>{{ editForm.name }}</span></el-form-item>
        <el-form-item label="供货价"><span>¥{{ money(editForm.supplyPrice) }}</span></el-form-item>
        <el-form-item label="渠道零售价">
          <el-input v-model="editForm.retailPrice" placeholder="留空则按供货价销售" />
        </el-form-item>
      </el-form>
      <p v-if="editForm.minRetailPrice != null || editForm.maxRetailPrice != null" class="dialog-tip">
        供应商限价：{{ editForm.minRetailPrice != null ? `¥${money(editForm.minRetailPrice)}` : `不低于供货价 ¥${money(editForm.supplyPrice)}` }}
        ~ {{ editForm.maxRetailPrice != null ? `¥${money(editForm.maxRetailPrice)}` : '不限' }}
      </p>
      <p class="dialog-tip">改价实时生效，不影响历史订单与已结算佣金；售价上限为供货价的 5 倍。</p>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePrice">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { channelApi } from '../api'
import { currentChannelId } from '../api/channelSession'

const route = useRoute()
const isEditPage = computed(() => route.path === '/listing')

const products = ref([])
const page = ref(1)
const size = ref(10)
const total = ref(0)
const editVisible = ref(false)
const saving = ref(false)
const editForm = reactive({ id: '', name: '', supplyPrice: 0, retailPrice: '', minRetailPrice: null, maxRetailPrice: null })

onMounted(loadProducts)

async function loadProducts() {
  const channelId = await currentChannelId()
  if (!channelId) {
    products.value = []
    total.value = 0
    return
  }
  try {
    const res = await channelApi.getProducts({
      channelId,
      page: page.value,
      size: size.value,
    })
    products.value = res.records || []
    total.value = res.total || 0
  } catch (e) {
    products.value = []
    total.value = 0
    ElMessage.error(e?.message || '货架读取失败')
  }
}


function handlePageChange(currentPage) {
  page.value = currentPage
  loadProducts()
}

const isOn = (row) => (row.shelfStatus || 'ON') !== 'OFF'

function openEdit(row) {
  editForm.id = row.id
  editForm.name = row.name
  editForm.supplyPrice = row.price
  editForm.retailPrice = row.retailPrice == null ? '' : String(row.retailPrice)
  editForm.minRetailPrice = row.minRetailPrice == null ? null : Number(row.minRetailPrice)
  editForm.maxRetailPrice = row.maxRetailPrice == null ? null : Number(row.maxRetailPrice)
  editVisible.value = true
}

async function savePrice() {
  saving.value = true
  try {
    const res = await channelApi.updateListing(editForm.id, {
      retailPrice: editForm.retailPrice.trim(),
    })
    if (res?.success === false) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    ElMessage.success('零售价已更新，立即生效')
    editVisible.value = false
    await loadProducts()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleShelf(row, next) {
  const label = next === 'OFF' ? '下架' : '上架'
  try {
    await ElMessageBox.confirm(
      next === 'OFF' ? '下架后商品在渠道店铺不可见，历史订单不受影响。' : '上架后商品立即在渠道店铺展示。',
      `${label}商品`,
      { confirmButtonText: label, cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    const res = await channelApi.updateListing(row.id, { shelfStatus: next })
    if (res?.success === false) {
      ElMessage.error(res.message || `${label}失败`)
      return
    }
    ElMessage.success(`已${label}`)
    await loadProducts()
  } catch (e) {
    ElMessage.error(e?.message || `${label}失败`)
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.products-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 760px; }
.filter-bar { display: flex; gap: 10px; align-items: center; }
.muted { color: #94a198; font-size: 12px; }
.dialog-tip { margin: 0; color: #84938a; font-size: 12px; line-height: 1.6; }
</style>
