<template>
  <div class="mds-page">
    <PageHeader
      title="行政区划"
      subtitle="省 / 市 / 区县 / 街道四级行政区划主数据，供地址标准化与主体注册选择。"
      source="主数据 · 地址域"
    >
      <template #actions>
        <button v-point="'POST /api/master-data/address/regions'" class="mds-btn mds-btn--primary" @click="openCreate">+ 新增区划</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="warning" title="数据现状与接口边界：">
      行政区划表当前为空，需要初始化（按层级新增或由数据导入）。
      后端只提供新增 / 修改接口，<b>没有删除接口</b> —— 因此本页不提供删除按钮，避免做成"点了没反应"。
    </NoticeBar>

    <StatGrid :items="statItems" />

    <div class="mds-card">
      <div class="mds-filter">
        <input v-model="filterKeyword" class="mds-input" type="search" placeholder="搜索区划名称 / 编码" />
        <select v-model="filterLevel" class="mds-select">
          <option value="all">全部层级</option>
          <option value="1">省级</option>
          <option value="2">市级</option>
          <option value="3">区县</option>
          <option value="4">街道 / 乡镇</option>
        </select>
        <span class="mds-hint">共 {{ filteredRegions.length }} / {{ regions.length }} 条</span>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table region-table">
          <thead>
            <tr>
              <th>区划编码</th>
              <th>区划名称</th>
              <th>层级</th>
              <th>上级编码</th>
              <th>拼音</th>
              <th>状态</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="mds-empty">正在加载行政区划…</td>
            </tr>
            <tr v-else-if="!filteredRegions.length">
              <td colspan="7">
                <EmptyState
                  :title="regions.length ? '没有符合条件的区划' : '暂无行政区划数据'"
                  :description="regions.length ? '调整层级或关键字筛选。' : '表内 0 行：先新增省级区划，再逐级补充下级。'"
                >
                  <button v-point="'POST /api/master-data/address/regions'" v-if="!regions.length" class="mds-btn" style="margin-top: 12px" @click="openCreate">
                    + 新增第一条区划
                  </button>
                </EmptyState>
              </td>
            </tr>
            <tr v-for="region in filteredRegions" :key="region.regionId">
              <td class="mds-mono">{{ region.regionCode || '—' }}</td>
              <td class="mds-name">
                <span :style="{ paddingLeft: `${(Number(region.level) - 1) * 14}px` }">{{ region.regionName }}</span>
              </td>
              <td><StatusTag :text="levelText(region.level)" tone="info" plain /></td>
              <td class="mds-mono">{{ region.parentCode || '—' }}</td>
              <td class="mds-muted">{{ region.pinyin || '—' }}</td>
              <td>
                <StatusTag
                  :text="region.status === '0' || region.status === 'disabled' ? '停用' : '启用'"
                  :tone="region.status === '0' || region.status === 'disabled' ? 'gray' : 'success'"
                />
              </td>
              <td class="mds-actions">
                <button v-point="'PUT /api/master-data/address/regions/{regionId}'" class="mds-btn mds-btn--link" @click="editRegion(region)">编辑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showModal" class="mds-mask" @click="closeModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ isEdit ? '编辑区划' : '新增区划' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">区划编码</span>
              <input v-model="form.regionCode" class="mds-input" :disabled="isEdit" placeholder="如 370000" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">区划名称</span>
              <input v-model="form.regionName" class="mds-input" placeholder="如 山东省" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">层级</span>
              <select v-model.number="form.level" class="mds-select">
                <option :value="1">省级</option>
                <option :value="2">市级</option>
                <option :value="3">区县</option>
                <option :value="4">街道 / 乡镇</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">上级编码</span>
              <input v-model="form.parentCode" class="mds-input" placeholder="如 370000（省级留空）" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">拼音</span>
              <input v-model="form.pinyin" class="mds-input" placeholder="如 shandong" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">状态</span>
              <select v-model="form.status" class="mds-select">
                <option value="1">启用</option>
                <option value="0">停用</option>
              </select>
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveRegion">
              {{ saving ? '保存中…' : isEdit ? '保存修改' : '新增区划' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { createRegion, getRegionTree, updateRegion } from '../../utils/api'

const regions = ref([])
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const isEdit = ref(false)
const filterLevel = ref('all')
const filterKeyword = ref('')

const form = reactive({
  regionId: '',
  regionCode: '',
  regionName: '',
  parentCode: '',
  level: 1,
  pinyin: '',
  status: '1',
})

const LEVEL_TEXT = { 1: '省级', 2: '市级', 3: '区县', 4: '街道/乡镇' }
const levelText = (level) => LEVEL_TEXT[Number(level)] ?? `第 ${level} 级`

const statItems = computed(() => {
  const list = regions.value
  return [
    { label: '区划总数', value: list.length },
    { label: '省级', value: list.filter((item) => Number(item.level) === 1).length },
    { label: '市级', value: list.filter((item) => Number(item.level) === 2).length },
    { label: '区县及以下', value: list.filter((item) => Number(item.level) >= 3).length, tone: 'brand' },
  ]
})

const filteredRegions = computed(() => {
  const kw = filterKeyword.value.trim().toLowerCase()
  return regions.value.filter((region) => {
    const matchLevel = filterLevel.value === 'all' || String(region.level) === filterLevel.value
    const matchKeyword =
      !kw ||
      String(region.regionName ?? '').toLowerCase().includes(kw) ||
      String(region.regionCode ?? '').toLowerCase().includes(kw)
    return matchLevel && matchKeyword
  })
})

/** 树 → 顺序表：父在前、子紧随，层级用于缩进（接口返回 children 嵌套） */
function flatten(nodes, out = []) {
  nodes.forEach((node) => {
    out.push(node)
    if (node.children?.length) flatten(node.children, out)
  })
  return out
}

const loadData = async () => {
  loading.value = true
  try {
    const response = await getRegionTree()
    if (response.code !== 200) throw new Error(response.message || '加载行政区划失败')
    regions.value = flatten((response.data ?? []))
  } catch (error) {
    regions.value = []
    message.error(error instanceof Error ? error.message : '加载行政区划失败')
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  Object.assign(form, {
    regionId: '',
    regionCode: '',
    regionName: '',
    parentCode: '',
    level: 1,
    pinyin: '',
    status: '1',
  })
  isEdit.value = false
  showModal.value = true
}

const editRegion = (region) => {
  isEdit.value = true
  Object.assign(form, {
    regionId: region.regionId,
    regionCode: region.regionCode ?? '',
    regionName: region.regionName ?? '',
    parentCode: region.parentCode ?? '',
    level: Number(region.level) || 1,
    pinyin: region.pinyin ?? '',
    status: region.status === '0' || region.status === 'disabled' ? '0' : '1',
  })
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  isEdit.value = false
}

const saveRegion = async () => {
  if (!form.regionCode.trim() || !form.regionName.trim()) {
    message.warning('区划编码与名称为必填')
    return
  }
  saving.value = true
  const payload = {
    regionId: form.regionId || form.regionCode,
    regionCode: form.regionCode.trim(),
    regionName: form.regionName.trim(),
    parentCode: form.parentCode || null,
    level: form.level,
    pinyin: form.pinyin,
    status: form.status,
  }
  try {
    const response = isEdit.value
      ? await updateRegion(form.regionId, payload)
      : await createRegion(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(isEdit.value ? '区划已更新' : '区划已新增')
    closeModal()
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.region-table {
  min-width: 960px;
}

.mds-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 20px;
}

.mds-modal {
  width: 640px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>
