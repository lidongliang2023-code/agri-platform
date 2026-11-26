<template>
  <PageContainer class="production-list-dense production-member-list" title="任务模板库" sub-title="平台统一维护标准农事作业规范（SOP），供各农场生产作业时标准化引用">
    <ProductionRequestTable :columns="columns" :request="load" :action-ref="action" row-key="templateId" :row-selection="{}" :pagination="{ defaultPageSize: 20 }" column-settings-storage-key="production:admin:templates:columns" column-width-storage-key="production:admin:templates:widths">
      <template #toolbar-left><a-button type="primary" @click="openEditor()"><PlusOutlined />新建任务模板</a-button></template>
      <template #cell-templateName="{ value }"><strong>{{ value }}</strong></template>
      <template #cell-taskType="{ value }"><a-tag>{{ TASK_TYPE_LABEL_MAP[String(value)] ?? value }}</a-tag></template>
      <template #cell-isSystem="{ value }"><a-tag :color="value ? 'purple' : undefined">{{ value ? '平台标准' : '主体自定义' }}</a-tag></template>
      <template #cell-status="{ value }"><a-tag :color="value === 1 ? 'success' : 'default'">{{ value === 1 ? '启用' : '停用' }}</a-tag></template>
      <template #cell-option="{ row }"><AgriVueRowActions :actions="actionsFor(row)" /></template>
    </ProductionRequestTable>
    <a-modal :open="editorOpen" :title="editing ? '编辑任务模板' : '新建任务模板'" :width="800" :confirm-loading="saving" :mask-closable="!saving" :closable="!saving" @cancel="closeEditor" @ok="save">
      <a-form ref="formRef" :model="form" layout="vertical" :disabled="saving">
        <a-row :gutter="20">
          <a-col :xs="24" :md="12"><a-form-item name="templateName" label="模板名称" :rules="[{ required: true, whitespace: true, message: '请输入模板名称' }]"><a-input v-model:value="form.templateName" placeholder="如：西红柿定植标准作业" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item name="cropName" label="适用作物"><a-select v-model:value="form.cropName" :options="cropOptions" show-search allow-clear placeholder="留空表示全品类通用" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item name="taskType" label="任务类型" :rules="[{ required: true, message: '请选择任务类型' }]"><a-select v-model:value="form.taskType" :options="TASK_TYPE_OPTIONS" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item name="growthStage" label="适用生长阶段"><a-input v-model:value="form.growthStage" placeholder="如：苗期、开花期、采收期" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item name="description" label="模板说明"><a-textarea v-model:value="form.description" :rows="2" :maxlength="500" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item name="standardHours" label="标准工时（小时）"><a-input-number v-model:value="form.standardHours" :min="0" :max="1000" :precision="0" style="width:100%" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item name="content" label="标准作业内容"><a-textarea v-model:value="form.content" :rows="4" :maxlength="500" show-count /></a-form-item></a-col>
          <a-col :span="24"><a-form-item name="inputItems" label="关联投入品清单"><a-select v-model:value="form.inputItems" mode="tags" placeholder="输入物料名称后回车，可添加多项" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item name="status" label="启用状态" :rules="[{ required: true, message: '请选择启用状态' }]"><a-radio-group v-model:value="form.status" :options="[{ value: 1, label: '启用（各农场可选择）' }, { value: 0, label: '停用（隐藏但保留引用）' }]" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item name="sortOrder" label="排序权重"><a-input-number v-model:value="form.sortOrder" :min="0" :max="9999" /></a-form-item></a-col>
          <a-col :span="24"><a-form-item name="remark" label="备注说明"><a-textarea v-model:value="form.remark" :rows="2" :maxlength="200" /></a-form-item></a-col>
        </a-row>
      </a-form>
    </a-modal>
  </PageContainer>
</template>
<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { Button as AButton, Form as AForm, FormItem as AFormItem, Input as AInput, InputNumber as AInputNumber, Modal as AModal, Select as ASelect, Tag as ATag, Textarea as ATextarea, Row as ARow, Col as ACol, RadioGroup as ARadioGroup, Modal, message, type FormInstance } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { AgriVueRowActions, type VueRowActionItem } from '@agri/shared/vue/list'
import ProductionRequestTable, { type ProductionColumn, type ProductionTableAction } from '@/vue/ProductionRequestTable'
import { PageContainer } from '@/vue/pro'
import { createTaskTemplate, deleteTaskTemplate, fetchTaskTemplatesPage, updateTaskTemplate } from '@/api/tasks'
import { listCrops } from '@/api/crops'
import { TASK_TYPE_LABEL_MAP, TASK_TYPE_OPTIONS, type TaskTemplate } from '@/types'
import '@/components/ProductionListDense.css'
interface TemplateRow extends TaskTemplate { requiredInputs?: string; sortOrder?: number; remark?: string }
interface TemplateForm { templateName: string; templateCode?: string; cropName?: string; taskType: string; standardHours?: number; content?: string; growthStage?: string; description?: string; inputItems: string[]; status: 0 | 1; sortOrder?: number; remark?: string }
const client = useQueryClient()
const cropsQuery = useQuery({ queryKey: ['admin-crop-options-for-templates'], queryFn: () => listCrops({ pageNum: 1, pageSize: 200 }), staleTime: 60000 })
const cropOptions = computed(() => (cropsQuery.data.value?.list ?? []).map(crop => ({ label: `${crop.cropName} (${crop.cropCategory || '通用'})`, value: crop.cropName })))
const action: { value?: ProductionTableAction | null } = {}
const formRef = ref<FormInstance>(), editing = ref<TemplateRow | null>(null), editorOpen = ref(false), saving = ref(false)
const form = reactive<TemplateForm>({ templateName: '', taskType: 'sowing', inputItems: [], status: 1, sortOrder: 0 })
const columns: ProductionColumn[] = [
  { title: '关键字检索', dataIndex: 'keyword', hideInTable: true, fieldProps: { placeholder: '输入模板名称或编码' } },
  { title: '模板编码', dataIndex: 'templateCode', width: 150, hideInSearch: true },
  { title: '模板名称', dataIndex: 'templateName', width: 180, hideInSearch: true },
  { title: '适用作物', dataIndex: 'cropName', width: 130, hideInSearch: true },
  { title: '任务类型', dataIndex: 'taskType', width: 110, valueEnum: Object.fromEntries(TASK_TYPE_OPTIONS.map(item => [item.value, item.label])) },
  { title: '标准工时(h)', dataIndex: 'standardHours', width: 110, align: 'right', hideInSearch: true },
  { title: '作业内容', dataIndex: 'content', ellipsis: true, hideInSearch: true },
  { title: '来源', dataIndex: 'isSystem', width: 100, hideInSearch: true },
  { title: '状态', dataIndex: 'status', width: 90, valueEnum: { '1': '启用', '0': '停用' } },
  { title: '操作', key: 'option', width: 160, fixed: 'right', valueType: 'option' },
]
async function load(params: Record<string, any>) {
  const result = await fetchTaskTemplatesPage({ pageNum: params.current ?? 1, pageSize: params.pageSize ?? 20, keyword: params.keyword, taskType: params.taskType, status: params.status == null ? undefined : Number(params.status) })
  return { data: result.list ?? [], total: result.total ?? 0, success: true }
}
async function reload() { await client.invalidateQueries({ queryKey: ['task-template-options'] }); await action.value?.reload() }
async function openEditor(row?: TemplateRow) {
  if (saving.value) return
  editing.value = row ?? null
  for (const key of Object.keys(form)) delete (form as unknown as Record<string, unknown>)[key]
  Object.assign(form, row ? { templateName: row.templateName, templateCode: row.templateCode, cropName: row.cropName, taskType: row.taskType ?? 'other', standardHours: row.standardHours, content: row.content, growthStage: row.growthStage, description: row.description, inputItems: row.inputItems ? [...row.inputItems] : row.requiredInputs?.split(',') ?? [], status: row.status ?? 1, sortOrder: row.sortOrder ?? 0, remark: row.remark } : { templateName: '', taskType: 'sowing', inputItems: [], status: 1, sortOrder: 0 })
  editorOpen.value = true; await nextTick(); formRef.value?.clearValidate()
}
function closeEditor() { if (!saving.value) { editorOpen.value = false; editing.value = null } }
async function save() {
  if (saving.value) return
  try { await formRef.value?.validate() } catch { return }
  const payload = { ...form, templateName: form.templateName.trim(), templateCode: form.templateCode?.trim() || undefined, cropName: form.cropName?.trim() ?? '', content: form.content?.trim() ?? '', growthStage: form.growthStage?.trim() ?? '', description: form.description?.trim() ?? '', inputItems: [...form.inputItems], sortOrder: form.sortOrder ?? 0, remark: form.remark?.trim() }
  saving.value = true
  try {
    if (editing.value) await updateTaskTemplate(editing.value.templateId, payload as Partial<TaskTemplate>)
    else await createTaskTemplate(payload as Partial<TaskTemplate>)
    message.success(editing.value ? '模板已更新' : '模板已创建并落库')
    editorOpen.value = false; editing.value = null; await reload()
  } catch (error) { message.error(error instanceof Error ? error.message : '保存失败') }
  finally { saving.value = false }
}
async function mutate(work: () => Promise<unknown>, text: string) { try { await work(); message.success(text); await reload() } catch (error) { message.error(error instanceof Error ? error.message : '操作失败') } }
function actionsFor(raw: Record<string, unknown>): VueRowActionItem[] {
  const row = raw as unknown as TemplateRow
  return [
    { key: 'edit', label: '编辑', onClick: () => { void openEditor(row) } },
    { key: 'status', label: row.status === 1 ? '停用' : '启用', danger: row.status === 1, onClick: () => {
      if (row.status === 1) Modal.confirm({ title: '确认停用该模板？', content: '停用后创建新任务时不可选择，已有引用任务不受影响。', onOk: () => mutate(() => updateTaskTemplate(row.templateId, { status: 0 }), '模板已停用') })
      else void mutate(() => updateTaskTemplate(row.templateId, { status: 1 }), '模板已启用')
    } },
    { key: 'delete', label: '删除', danger: true, onClick: () => { Modal.confirm({ title: '确认删除该模板？', content: '删除后不可恢复。', okButtonProps: { danger: true }, onOk: () => mutate(() => deleteTaskTemplate(row.templateId), '模板已删除') }) } },
  ]
}
</script>
