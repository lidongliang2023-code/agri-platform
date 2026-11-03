<template>
  <div class="mds-page">
    <PageHeader
      title="数据字典"
      subtitle="平台级标准枚举（共享）与租户扩展枚举（隔离），支撑各业务模块的字段取值规范。"
      source="数据标准 · 字典"
    >
      <template #actions>
        <button v-point="'POST /admin/masterdata/standard/dict'" class="mds-btn mds-btn--primary" @click="openCreateModal">+ 新增字典</button>
        <button class="mds-btn" :disabled="loading" @click="loadData">刷新</button>
      </template>
    </PageHeader>

    <NoticeBar tone="info" title="维护口径：">
      字典项的值（itemValue）一旦被业务引用，只允许停用、不建议物理删除；改值会使历史数据对不上。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-filter">
        <input
          v-model="searchForm.keyword"
          class="mds-input"
          type="search"
          placeholder="字典名称 / 编码"
          @keyup.enter="search"
        />
        <select v-model="searchForm.status" class="mds-select" @change="search">
          <option value="">全部状态</option>
          <option value="1">启用</option>
          <option value="0">禁用</option>
        </select>
        <button class="mds-btn mds-btn--primary" @click="search">查询</button>
        <button class="mds-btn" @click="reset">重置</button>
      </div>

      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>字典编码</th>
              <th>字典名称</th>
              <th>字典类型</th>
              <th>描述</th>
              <th>状态</th>
              <th>创建时间</th>
              <th class="mds-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7" class="mds-empty">正在加载字典…</td>
            </tr>
            <tr v-else-if="!tableData.length">
              <td colspan="7">
                <EmptyState title="暂无符合条件的字典" description="调整关键字或状态筛选；也可以直接新增字典。" />
              </td>
            </tr>
            <tr v-for="dict in tableData" :key="dict.id">
              <td class="mds-mono">{{ dict.dictCode || '—' }}</td>
              <td class="mds-name">{{ dict.dictName || '—' }}</td>
              <td>{{ dict.dictType || '—' }}</td>
              <td class="desc-cell">{{ dict.description || '—' }}</td>
              <td>
                <StatusTag
                  :text="Number(dict.status) === 1 ? '启用' : '禁用'"
                  :tone="Number(dict.status) === 1 ? 'success' : 'gray'"
                />
              </td>
              <td class="mds-muted">{{ formatDate(dict.createTime) }}</td>
              <td class="mds-actions">
                <button class="mds-btn mds-btn--link" @click="viewItems(dict)">字典项</button>
                <button v-point="'PUT /admin/masterdata/standard/dict/{id}'" class="mds-btn mds-btn--link" @click="editDict(dict)">编辑</button>
                <button v-point="'DELETE /admin/masterdata/standard/dict/{id}'" class="mds-btn mds-btn--link mds-danger" @click="deleteDict(dict.id)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <PagerBar
        :page="pageNum"
        :page-size="pageSize"
        :total="total"
        @change="handleCurrentChange"
        @update:page-size="changePageSize"
      />
    </div>

    <!-- 新增 / 编辑字典 -->
    <div v-if="modalVisible" class="mds-mask" @click="closeModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ form.id ? '编辑字典' : '新增字典' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">字典编码</span>
              <input v-model="form.dictCode" class="mds-input" :disabled="Boolean(form.id)" placeholder="如 user_identity_type" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">字典名称</span>
              <input v-model="form.dictName" class="mds-input" placeholder="如 用户身份类型" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">字典类型</span>
              <input v-model="form.dictType" class="mds-input" placeholder="如 platform / tenant" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">状态</span>
              <select v-model.number="form.status" class="mds-select">
                <option :value="1">启用</option>
                <option :value="0">禁用</option>
              </select>
            </label>
            <label class="mds-field mds-field--full">
              <span class="mds-field__label">描述</span>
              <textarea v-model="form.description" class="mds-textarea" placeholder="字典用途、维护要求" />
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveDict">
              {{ saving ? '保存中…' : form.id ? '保存修改' : '确认新增' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 字典项管理 -->
    <div v-if="itemsModalVisible" class="mds-mask" @click="closeItemsModal">
      <div class="mds-modal mds-modal--wide" @click.stop>
        <div class="mds-card-head">
          <div>
            <h2 class="mds-card-title">{{ currentDictName }} · 字典项</h2>
            <p class="mds-card-sub">值（code）用于存储，标签用于展示</p>
          </div>
          <div class="mds-head-actions">
            <button v-point="'POST /admin/masterdata/standard/dict/{id}/item'" class="mds-btn mds-btn--primary mds-btn--sm" @click="openItemCreateModal">+ 添加字典项</button>
            <button class="mds-btn" @click="closeItemsModal">关闭</button>
          </div>
        </div>
        <div class="mds-table-wrap">
          <table class="mds-table">
            <thead>
              <tr>
                <th>值</th>
                <th>标签</th>
                <th class="mds-num">排序</th>
                <th>状态</th>
                <th class="mds-actions">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!dictItems.length">
                <td colspan="5">
                  <EmptyState title="该字典还没有字典项" description="点击右上角「添加字典项」开始维护。" />
                </td>
              </tr>
              <tr v-for="item in dictItems" :key="item.id">
                <td class="mds-mono">{{ item.itemValue }}</td>
                <td>{{ item.itemName }}</td>
                <td class="mds-num">{{ item.itemSort }}</td>
                <td>
                  <StatusTag
                    :text="Number(item.status) === 1 ? '启用' : '禁用'"
                    :tone="Number(item.status) === 1 ? 'success' : 'gray'"
                  />
                </td>
                <td class="mds-actions">
                  <button v-point="'PUT /admin/masterdata/standard/dict/item/{itemId}'" class="mds-btn mds-btn--link" @click="editDictItem(item)">编辑</button>
                  <button v-point="'DELETE /admin/masterdata/standard/dict/item/{itemId}'" class="mds-btn mds-btn--link mds-danger" @click="deleteDictItem(item.id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 新增 / 编辑字典项 -->
    <div v-if="itemModalVisible" class="mds-mask" @click="closeItemModal">
      <div class="mds-modal mds-modal--sm" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ itemForm.id ? '编辑字典项' : '新增字典项' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeItemModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">值（code）</span>
              <input v-model="itemForm.itemValue" class="mds-input" placeholder="如 L4" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">标签</span>
              <input v-model="itemForm.itemLabel" class="mds-input" placeholder="如 企业任职用户" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">排序</span>
              <input v-model.number="itemForm.sortOrder" class="mds-input" type="number" min="0" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label">状态</span>
              <select v-model.number="itemForm.status" class="mds-select">
                <option :value="1">启用</option>
                <option :value="0">禁用</option>
              </select>
            </label>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeItemModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveDictItem">
              {{ saving ? '保存中…' : itemForm.id ? '保存修改' : '确认新增' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PagerBar from '@/components/ui/PagerBar.vue'
import {
  createDict,
  createDictItem,
  deleteDict as apiDeleteDict,
  deleteDictItem as apiDeleteDictItem,
  getDictDetail,
  getDictList,
  updateDict,
  updateDictItem,
} from '../../utils/api'

const tableData = ref([])
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const modalVisible = ref(false)
const itemsModalVisible = ref(false)
const itemModalVisible = ref(false)
const currentDictName = ref('')
const currentDictId = ref(null)
const dictItems = ref([])

const searchForm = reactive({ keyword: '', status: '' })

const form = reactive({
  id: null,
  dictCode: '',
  dictName: '',
  dictType: '',
  description: '',
  status: 1,
})

const itemForm = reactive({
  id: null,
  itemValue: '',
  itemLabel: '',
  sortOrder: 1,
  status: 1,
})

const loadData = async () => {
  loading.value = true
  try {
    const response = await getDictList({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      keyword: searchForm.keyword || undefined,
      status: searchForm.status || undefined,
    })
    if (response.code !== 200) throw new Error(response.message || '加载数据失败')
    tableData.value = response.data?.list ?? []
    total.value = Number(response.data?.total ?? 0)
  } catch (error) {
    tableData.value = []
    total.value = 0
    message.error(error instanceof Error ? error.message : '加载数据失败')
  } finally {
    loading.value = false
  }
}

function search() {
  pageNum.value = 1
  void loadData()
}

function reset() {
  Object.assign(searchForm, { keyword: '', status: '' })
  search()
}

function handleCurrentChange(next) {
  pageNum.value = next
  void loadData()
}

function changePageSize(size) {
  pageSize.value = size
  pageNum.value = 1
  void loadData()
}

const openCreateModal = () => {
  Object.assign(form, { id: null, dictCode: '', dictName: '', dictType: '', description: '', status: 1 })
  modalVisible.value = true
}

const editDict = (row) => {
  Object.assign(form, {
    id: row.id,
    dictCode: row.dictCode ?? '',
    dictName: row.dictName ?? '',
    dictType: row.dictType ?? '',
    description: row.description ?? '',
    status: Number(row.status ?? 1),
  })
  modalVisible.value = true
}

const closeModal = () => {
  modalVisible.value = false
}

const saveDict = async () => {
  if (!form.dictCode.trim() || !form.dictName.trim()) {
    message.warning('字典编码与名称为必填')
    return
  }
  saving.value = true
  try {
    const payload = { ...form }
    const response = form.id ? await updateDict(form.id, payload) : await createDict(payload)
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(form.id ? '字典已更新' : '字典已创建')
    closeModal()
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
  }
}

const deleteDict = async (id) => {
  if (!window.confirm('确定删除该字典？字典项会一并不可见，历史引用不会自动清理。')) return
  try {
    const response = await apiDeleteDict(id)
    if (response.code !== 200) throw new Error(response.message || '删除失败')
    message.success('字典已删除')
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  }
}

/** 打开字典项：按字典 id 查真实条目（旧实现曾写死"是/否"两条假数据）。 */
const viewItems = async (row) => {
  currentDictName.value = row.dictName
  currentDictId.value = row.id
  try {
    const response = await getDictDetail(row.id)
    if (response.code !== 200) throw new Error(response.message || '加载字典项失败')
    dictItems.value = response.data?.items ?? []
  } catch (error) {
    dictItems.value = []
    message.error(error instanceof Error ? error.message : '加载字典项失败')
  }
  itemsModalVisible.value = true
}

const closeItemsModal = () => {
  itemsModalVisible.value = false
}

const openItemCreateModal = () => {
  Object.assign(itemForm, { id: null, itemValue: '', itemLabel: '', sortOrder: 1, status: 1 })
  itemModalVisible.value = true
}

const editDictItem = (row) => {
  Object.assign(itemForm, {
    id: row.id,
    itemValue: row.itemValue ?? '',
    // 接口字段是 itemName / itemSort
    itemLabel: row.itemName ?? '',
    sortOrder: Number(row.itemSort ?? 1),
    status: Number(row.status ?? 1),
  })
  itemModalVisible.value = true
}

const closeItemModal = () => {
  itemModalVisible.value = false
}

const saveDictItem = async () => {
  if (!itemForm.itemValue.trim() || !itemForm.itemLabel.trim()) {
    message.warning('值与标签为必填')
    return
  }
  saving.value = true
  const payload = {
    itemName: itemForm.itemLabel,
    itemValue: itemForm.itemValue,
    itemSort: Number(itemForm.sortOrder) || 1,
    status: itemForm.status,
  }
  try {
    // 写接口 + 回读：原来只改本地数组，关掉弹窗就回到原样
    const response = itemForm.id
      ? await updateDictItem(itemForm.id, payload)
      : await createDictItem(currentDictId.value, payload)
    if (response.code !== 200) throw new Error(response.message || '操作失败')
    message.success(itemForm.id ? '字典项已更新' : '字典项已添加')
    closeItemModal()
    await viewItems({ id: currentDictId.value, dictName: currentDictName.value })
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
  }
}

const deleteDictItem = async (id) => {
  if (!window.confirm('确定删除该字典项？已引用该值的业务数据会失去对应标签。')) return
  try {
    const response = await apiDeleteDictItem(id)
    if (response.code !== 200) throw new Error(response.message || '删除失败')
    message.success('字典项已删除')
    await viewItems({ id: currentDictId.value, dictName: currentDictName.value })
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  }
}

const formatDate = (date) => (date ? String(date).replace('T', ' ').split(' ')[0] : '—')

onMounted(loadData)
</script>

<style scoped>
.desc-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  width: 680px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}

.mds-modal--wide {
  width: 860px;
}

.mds-modal--sm {
  width: 520px;
}
</style>
