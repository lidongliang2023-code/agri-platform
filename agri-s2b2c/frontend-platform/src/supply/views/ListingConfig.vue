<template>
  <div class="listing-config-page">
    <div class="page-head">
      <div>
        <h2>投放规则配置</h2>
        <p>按商品控制渠道能否投放、允许的渠道白名单、最大授权渠道数与限售区域；规则收紧会自动撤销不符合的既有授权并通知渠道。</p>
      </div>
      <div class="head-actions">
        <el-button :loading="scanning" @click="scanPriceGuard">扫描超低价并下架</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
    </div>

    <div class="card">
      <el-table :data="rows" border>
        <el-table-column prop="name" label="商品" min-width="180" />
        <el-table-column label="审核状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="允许渠道投放" width="140">
          <template #default="{ row }">
            <el-switch v-model="row.distributionEnabled" @change="(value) => save(row, value)" />
          </template>
        </el-table-column>
        <el-table-column label="最大授权渠道" width="150">
          <template #default="{ row }">
            <el-input-number v-model="row.maxChannels" :min="0" :precision="0" size="small" style="width: 96px" />
            <span class="unit">0=不限</span>
          </template>
        </el-table-column>
        <el-table-column label="最低零售价" width="150">
          <template #default="{ row }">
            <el-input-number v-model="row.minRetailPrice" :min="0" :precision="2" size="small" style="width: 100px" />
          </template>
        </el-table-column>
        <el-table-column label="最高零售价" width="150">
          <template #default="{ row }">
            <el-input-number v-model="row.maxRetailPrice" :min="0" :precision="2" size="small" style="width: 100px" />
          </template>
        </el-table-column>
        <el-table-column label="渠道白名单" width="170">
          <template #default="{ row }">
            <span v-if="!row.whitelistIds.length" class="muted">不限渠道</span>
            <span v-else>已限定 {{ row.whitelistIds.length }} 个渠道</span>
          </template>
        </el-table-column>
        <el-table-column label="限售区域" width="220">
          <template #default="{ row }">
            <span v-if="!row.regionNames.length" class="muted">全国（不限）</span>
            <span v-else>{{ row.regionNames.join('、') }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openWhitelist(row)">白名单</el-button>
            <el-button link type="primary" @click="openRegions(row)">限售区域</el-button>
            <el-button link type="primary" @click="save(row, row.distributionEnabled)">保存</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!rows.length" description="暂无商品" :image-size="70" />
    </div>

    <div class="card">
      <h3>规则说明</h3>
      <ul>
        <li>关闭投放或设置白名单后，不符合条件的 ACTIVE 授权会自动撤销，并向渠道发送站内通知；历史订单与佣金不受影响。</li>
        <li>最大授权渠道数按 ACTIVE 关系计数，超出时保留最早选品的渠道，撤销其余渠道授权。</li>
        <li>白名单为空表示不限制渠道；零售价区间只约束后续改价，已越界的在售价不自动修改。</li>
        <li>最低/最高零售价都不得低于供货价；渠道改价低于供货价会被直接拒绝。</li>
        <li>限售区域按收货省份校验：留空表示全国可售；配置后，渠道订单的收货地址不在区域内会被直接拒绝。只支持省级，暂不支持按市/区限售。</li>
      </ul>
    </div>

    <el-dialog v-model="whitelistVisible" title="渠道白名单" width="560px">
      <p class="muted">当前商品：{{ current?.name }}。留空表示不限制渠道；保存后会自动撤销不在白名单内的现有授权。</p>
      <el-select v-model="whitelistSelection" multiple filterable placeholder="选择允许投放的渠道" style="width: 100%">
        <el-option v-for="channel in channels" :key="channel.channelId"
          :label="`${channel.shopName || channel.channelId}（${gradeText(channel.grade)}）`" :value="channel.channelId" />
      </el-select>
      <template #footer>
        <el-button @click="whitelistVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingWhitelist" @click="saveWhitelist">保存白名单</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="regionVisible" title="限售区域" width="560px">
      <p class="muted">当前商品：{{ current?.name }}。留空表示全国可售；保存后，收货地址不在所选省份的渠道订单会被拒绝。</p>
      <el-select v-model="regionSelection" multiple filterable placeholder="选择允许销售的省份" style="width: 100%">
        <el-option v-for="province in provinces" :key="province" :label="province" :value="province" />
      </el-select>
      <template #footer>
        <el-button @click="regionVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingRegion" @click="saveRegions">保存限售区域</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { supplierApi } from '../api'
import { currentSupplierId } from '../api/supplierSession'
import { PROVINCES } from '../../../../frontend-shared/constants/regions.js'

const rows = ref([])
const channels = ref([])
const scanning = ref(false)
const whitelistVisible = ref(false)
const whitelistSelection = ref([])
const current = ref(null)
const savingWhitelist = ref(false)
const provinces = PROVINCES
const regionVisible = ref(false)
const regionSelection = ref([])
const savingRegion = ref(false)

onMounted(async () => {
  try {
    channels.value = (await supplierApi.getAvailableChannels()) || []
  } catch {
    channels.value = []
  }
  await load()
})

async function load() {
  try {
    const supplierId = await currentSupplierId()
    if (!supplierId) {
      rows.value = []
      return
    }
    const res = await supplierApi.getProducts({ supplierId, page: 1, size: 50 })
    const list = res.records || []
    const withRules = await Promise.all(list.map(async (row) => {
      try {
        const rule = await supplierApi.getDistributionRule(row.id)
        return {
          ...row,
          distributionEnabled: rule?.enabled !== false,
          maxChannels: Number(rule?.maxChannels || 0),
          minRetailPrice: rule?.minRetailPrice == null ? null : Number(rule.minRetailPrice),
          maxRetailPrice: rule?.maxRetailPrice == null ? null : Number(rule.maxRetailPrice),
          whitelistIds: (rule?.whitelist || []).map((item) => item.channelId),
          regionNames: rule?.regionNames || [],
        }
      } catch {
        return { ...row, distributionEnabled: row.distributionEnabled !== false,
          maxChannels: Number(row.maxChannels || 0), minRetailPrice: null, maxRetailPrice: null,
          whitelistIds: [], regionNames: [] }
      }
    }))
    rows.value = withRules
  } catch (e) {
    rows.value = []
    ElMessage.error(e?.message || '投放规则读取失败')
  }
}

async function persist(row, channelIds, regionNames = row.regionNames || []) {
  const supply = Number(row.price || 0)
  if (row.minRetailPrice != null && Number(row.minRetailPrice) < supply) {
    throw new Error(`最低零售价不能低于供货价 ¥${supply.toFixed(2)}`)
  }
  if (row.maxRetailPrice != null && Number(row.maxRetailPrice) < supply) {
    throw new Error(`最高零售价不能低于供货价 ¥${supply.toFixed(2)}`)
  }
  const res = await supplierApi.saveDistributionRule(row.id, {
    enabled: Boolean(row.distributionEnabled),
    maxChannels: Number(row.maxChannels || 0),
    minRetailPrice: row.minRetailPrice == null ? '' : row.minRetailPrice,
    maxRetailPrice: row.maxRetailPrice == null ? '' : row.maxRetailPrice,
    channelIds,
    regionNames,
  })
  if (res?.success === false) throw new Error(res.message || '保存失败')
  return res
}

async function save(row, enabled) {
  row.distributionEnabled = Boolean(enabled)
  try {
    const res = await persist(row, row.whitelistIds || [])
    ElMessage.success(`投放规则已保存${Number(res?.revoked || 0) > 0 ? `，自动撤销 ${res.revoked} 个授权` : ''}${Number(res?.autoOffShelf || 0) > 0 ? `，自动下架 ${res.autoOffShelf} 个超低价商品` : ''}${Number(res?.outOfRange || 0) > 0 ? `；${res.outOfRange} 个在售价格越界` : ''}`)
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  }
}

function openWhitelist(row) {
  current.value = row
  whitelistSelection.value = [...(row.whitelistIds || [])]
  whitelistVisible.value = true
}

function openRegions(row) {
  current.value = row
  regionSelection.value = [...(row.regionNames || [])]
  regionVisible.value = true
}

async function saveRegions() {
  if (!current.value) return
  savingRegion.value = true
  try {
    await persist(current.value, current.value.whitelistIds || [], regionSelection.value)
    ElMessage.success(regionSelection.value.length
      ? `已限制 ${regionSelection.value.length} 个销售省份`
      : '已改为全国可售')
    regionVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingRegion.value = false
  }
}

async function saveWhitelist() {
  if (!current.value) return
  savingWhitelist.value = true
  try {
    const res = await persist(current.value, whitelistSelection.value)
    ElMessage.success(`白名单已保存${Number(res?.revoked || 0) > 0 ? `，自动撤销 ${res.revoked} 个授权` : ''}`)
    whitelistVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingWhitelist.value = false
  }
}

async function scanPriceGuard() {
  scanning.value = true
  try {
    const res = await supplierApi.scanPriceGuard()
    if (res?.success === false) return ElMessage.error(res.message || '扫描失败')
    ElMessage.success(res?.message || '扫描完成')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '扫描失败')
  } finally {
    scanning.value = false
  }
}

const statusText = (value) => ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已拒绝' }[value] || value)
const statusType = (value) => ({ PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }[value] || 'info')
const gradeText = (value) => ({ LEVEL_1: '铜牌', LEVEL_2: '银牌', LEVEL_3: '金牌' }[value] || value || '未定级')
</script>

<style scoped>
.listing-config-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card h3 { margin: 0 0 10px; font-size: 15px; }
.card ul { margin: 0; padding-left: 18px; color: #52665a; font-size: 13px; line-height: 1.9; }
.unit { margin-left: 6px; color: #94a198; font-size: var(--agri-font-size-micro); }
.head-actions { display: flex; gap: 8px; }
.muted { color: #84938a; font-size: 12px; }
</style>
