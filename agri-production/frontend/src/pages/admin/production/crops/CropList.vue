<template>
  <PageContainer class="production-list-dense production-member-list" title="作物管理" sub-title="维护平台作物基础主数据，供农事生产、地块排产与批次采收全局引用">
    <ProductionRequestTable :columns="columns" :request="load" :action-ref="action" row-key="cropId" :row-selection="{}" :pagination="{ defaultPageSize: 20 }" column-settings-storage-key="production:admin:crops:columns" column-width-storage-key="production:admin:crops:widths">
      <template #toolbar-left><a-button type="primary" @click="openEditor()"><PlusOutlined />新增作物</a-button></template>
      <template #cell-cropName="{ row }"><strong>{{ row.cropName }}</strong></template>
      <template #cell-cropCategory="{ value }"><a-tag v-if="value" color="blue">{{ value }}</a-tag><span v-else>—</span></template>
      <template #cell-status="{ value }"><a-tag :color="value === 1 ? 'success' : 'default'">{{ value === 1 ? '启用' : '停用' }}</a-tag></template>
      <template #cell-option="{ row }"><AgriVueRowActions :actions="actionsFor(row)" /></template>
    </ProductionRequestTable>
    <a-modal :open="editorOpen" :title="editing ? `编辑作物 · ${editing.cropName}` : '新增作物'" :width="560" :confirm-loading="saving" :mask-closable="!saving" :closable="!saving" @cancel="closeEditor" @ok="save">
      <a-form ref="formRef" :model="form" layout="vertical" :disabled="saving">
        <a-form-item name="cropName" label="作物名称" :rules="[{ required: true, whitespace: true, message: '请输入作物名称' }, { max: 50, message: '作物名称不超过50个字符' }]"><a-input v-model:value="form.cropName" placeholder="如：西红柿 / 黄瓜 / 水稻" /></a-form-item>
        <a-form-item name="cropCode" label="作物编码" :rules="[{ max: 50, message: '编码不超过50个字符' }]"><a-input v-model:value="form.cropCode" :disabled="Boolean(editing)" placeholder="留空自动生成" /></a-form-item>
        <a-form-item name="cropCategory" label="作物类别" :rules="[{ required: true, message: '请选择类别' }]"><a-select v-model:value="form.cropCategory" :options="categoryOptions" placeholder="请选择作物类别" /></a-form-item>
        <a-form-item name="growthCycleDays" label="标准生长周期（天）"><a-input-number v-model:value="form.growthCycleDays" :min="1" :max="3650" style="width:100%" /></a-form-item>
        <a-form-item name="measurementUnit" label="主要采收计量单位"><a-input v-model:value="form.measurementUnit" placeholder="如：kg / 吨 / 箱" /></a-form-item>
        <a-form-item v-if="editing" name="status" label="状态"><a-select v-model:value="form.status" :options="[{ value: 1, label: '启用' }, { value: 0, label: '停用' }]" /></a-form-item>
        <a-form-item name="sortNo" label="排序权重"><a-input-number v-model:value="form.sortNo" :min="0" :max="9999" style="width:100%" /></a-form-item>
        <a-form-item name="remark" label="备注说明"><a-textarea v-model:value="form.remark" :rows="3" /></a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { Button as AButton, Form as AForm, FormItem as AFormItem, Input as AInput, InputNumber as AInputNumber, Modal as AModal, Select as ASelect, Tag as ATag, Textarea as ATextarea, Modal, message, type FormInstance } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { AgriVueRowActions, type VueRowActionItem } from '@agri/shared/vue/list'
import ProductionRequestTable, { type ProductionColumn, type ProductionTableAction } from '@/vue/ProductionRequestTable'
import { PageContainer } from '@/vue/pro'
import { createCrop, deleteCrop, listCropCategories, listCrops, updateCrop, updateCropStatus, type Crop } from '@/api/crops'
import '@/components/ProductionListDense.css'
interface CropFormValue { cropCode?: string; cropName: string; cropCategory?: string; growthCycleDays?: number; measurementUnit?: string; status: number; sortNo?: number; remark?: string }
const client = useQueryClient()
const categoryQuery = useQuery({ queryKey: ['crop-categories'], queryFn: listCropCategories, staleTime: 300000 })
const categoryOptions = computed(() => (categoryQuery.data.value ?? []).map(value => ({ value, label: value })))
const action: { value?: ProductionTableAction | null } = {}
const formRef = ref<FormInstance>()
const form = reactive<CropFormValue>({ cropName: '', status: 1, sortNo: 0 })
const editing = ref<Crop | null>(null), editorOpen = ref(false), saving = ref(false)
const columns: ProductionColumn[] = [
  { title: '作物编码', dataIndex: 'cropCode', width: 140, hideInSearch: true },
  { title: '作物名称', dataIndex: 'cropName', width: 160 },
  { title: '类别', dataIndex: 'cropCategory', width: 120, hideInSearch: true },
  { title: '生长周期(天)', dataIndex: 'growthCycleDays', width: 120, hideInSearch: true, align: 'right' },
  { title: '计量单位', dataIndex: 'measurementUnit', width: 100, hideInSearch: true },
  { title: '状态', dataIndex: 'status', width: 100, valueEnum: { '1': '启用', '0': '停用' } },
  { title: '排序权重', dataIndex: 'sortNo', width: 90, hideInSearch: true },
  { title: '备注说明', dataIndex: 'remark', ellipsis: true, hideInSearch: true },
  { title: '操作', key: 'option', width: 160, fixed: 'right', valueType: 'option' },
]
async function load(params: Record<string, any>) {
  const result = await listCrops({ pageNum: params.current ?? 1, pageSize: params.pageSize ?? 20, keyword: params.cropName || undefined, status: params.status == null ? undefined : Number(params.status) })
  return { data: result.list, total: result.total, success: true }
}
async function reload() {
  await Promise.all([client.invalidateQueries({ queryKey: ['crop-options'] }), client.invalidateQueries({ queryKey: ['admin-crop-options-for-templates'] })])
  await action.value?.reload()
}
async function openEditor(row?: Crop) {
  if (saving.value) return
  editing.value = row ?? null
  for (const key of Object.keys(form)) delete (form as unknown as Record<string, unknown>)[key]
  Object.assign(form, row ? { cropCode: row.cropCode, cropName: row.cropName, cropCategory: row.cropCategory, growthCycleDays: row.growthCycleDays, measurementUnit: row.measurementUnit, status: row.status, sortNo: row.sortNo, remark: row.remark } : { cropName: '', status: 1, sortNo: 0 })
  editorOpen.value = true
  await nextTick(); formRef.value?.clearValidate()
}
function closeEditor() { if (!saving.value) { editorOpen.value = false; editing.value = null } }
async function save() {
  if (saving.value) return
  try { await formRef.value?.validate() } catch { return }
  saving.value = true
  try {
    if (editing.value) await updateCrop(editing.value.cropId, { ...form })
    else await createCrop({ ...form })
    message.success(editing.value ? '作物已保存' : '作物已新增')
    editorOpen.value = false; editing.value = null; await reload()
  } catch (error) { message.error(error instanceof Error ? error.message : '保存失败') }
  finally { saving.value = false }
}
async function mutate(work: () => Promise<unknown>, success: string) {
  try { await work(); message.success(success); await reload() }
  catch (error) { message.error(error instanceof Error ? error.message : '操作失败') }
}
function actionsFor(raw: Record<string, unknown>): VueRowActionItem[] {
  const row = raw as unknown as Crop
  return [
    { key: 'edit', label: '编辑', onClick: () => { void openEditor(row) } },
    { key: 'status', label: row.status === 1 ? '停用' : '启用', danger: row.status === 1, onClick: () => {
      if (row.status === 1) Modal.confirm({ title: '停用作物', content: '停用后新计划不可选择该作物，历史数据不受影响。确认停用？', onOk: () => mutate(() => updateCropStatus(row.cropId, 0), '作物已停用') })
      else void mutate(() => updateCropStatus(row.cropId, 1), '作物已启用')
    } },
    { key: 'delete', label: '删除', danger: true, onClick: () => { Modal.confirm({ title: '删除作物', content: '已被农事计划引用的作物不能删除。确认删除？', okButtonProps: { danger: true }, onOk: () => mutate(() => deleteCrop(row.cropId), '作物已删除') }) } },
  ]
}
</script>
