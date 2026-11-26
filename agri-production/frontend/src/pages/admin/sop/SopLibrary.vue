<template>
  <PageContainer class="production-list-dense production-member-list" title="生产域 SOP 规程库" sub-title="标准化种植、植保与采收操作规程维护与发布">
    <a-space direction="vertical" :size="12" style="width:100%">
      <a-alert v-if="failure" type="error" show-icon message="规程库加载失败" :description="failure" />
      <a-row :gutter="12"><a-col :span="8"><a-card><a-statistic title="规程总数" :value="total" /></a-card></a-col><a-col :span="8"><a-card><a-statistic title="当前页已发布" :value="rows.filter(r => r.status === 1).length" /></a-card></a-col><a-col :span="8"><a-card><a-statistic title="当前页草稿" :value="rows.filter(r => r.status === 0).length" /></a-card></a-col></a-row>
      <ProductionRequestTable :columns="columns" :request="load" :action-ref="action" row-key="sopId" :row-selection="{}" :pagination="{ defaultPageSize: 20 }" column-settings-storage-key="production:admin:sop:columns" column-width-storage-key="production:admin:sop:widths">
        <template #toolbar-left><a-button type="primary" @click="openEditor()"><PlusOutlined />新增规程</a-button></template>
        <template #cell-sopName="{ value }"><strong>{{ value || '—' }}</strong></template>
        <template #cell-sopType="{ value }"><a-tag>{{ typeOptions.find(item => item.value === value)?.label ?? value }}</a-tag></template>
        <template #cell-stageSeq="{ value }">{{ value == null ? '—' : `第${value}阶段` }}</template>
        <template #cell-status="{ value }"><a-tag :color="value === 1 ? 'success' : 'default'">{{ value === 1 ? '已发布' : '草稿' }}</a-tag></template>
        <template #cell-action="{ row }"><AgriVueRowActions :actions="actionsFor(row)" /></template>
      </ProductionRequestTable>
    </a-space>
    <a-drawer :title="editing ? '编辑生产SOP' : '新增生产SOP'" width="min(1080px, 100vw)" :open="editorOpen" :mask-closable="!busy" :closable="!busy" @close="closeEditor">
      <template #extra><a-space><a-button :disabled="busy" @click="closeEditor">取消</a-button><a-button type="primary" :loading="saving" :disabled="imageUploading" @click="save">保存到生产域</a-button></a-space></template>
      <a-form ref="formRef" :model="form" layout="vertical" :disabled="saving">
        <a-row :gutter="16"><a-col :xs="24" :md="12"><a-form-item name="sopCode" label="规程编码"><a-input v-model:value="form.sopCode" :maxlength="64" placeholder="不填则自动生成" /></a-form-item></a-col><a-col :xs="24" :md="12"><a-form-item name="sopName" label="规程名称" :rules="[{ required: true, whitespace: true, message: '请输入规程名称' }]"><a-input v-model:value="form.sopName" :maxlength="100" /></a-form-item></a-col></a-row>
        <a-row :gutter="16"><a-col :xs="24" :md="8"><a-form-item name="sopType" label="规程类型" :rules="[{ required: true, message: '请选择规程类型' }]"><a-select v-model:value="form.sopType" :options="typeOptions" /></a-form-item></a-col><a-col :xs="24" :md="8"><a-form-item name="cropId" label="作物ID"><a-input v-model:value="form.cropId" :maxlength="64" /></a-form-item></a-col><a-col :xs="24" :md="8"><a-form-item name="versionNo" label="版本号"><a-input v-model:value="form.versionNo" :maxlength="16" /></a-form-item></a-col></a-row>
        <a-row :gutter="16"><a-col :xs="24" :md="8"><a-form-item name="stageSeq" label="适用阶段"><a-input-number v-model:value="form.stageSeq" :min="1" :precision="0" style="width:100%" /></a-form-item></a-col><a-col :xs="24" :md="8"><a-form-item name="applicableRegion" label="适用区域"><a-input v-model:value="form.applicableRegion" :maxlength="100" /></a-form-item></a-col><a-col :xs="24" :md="8"><a-form-item name="publisher" label="发布人"><a-input v-model:value="form.publisher" :maxlength="50" /></a-form-item></a-col></a-row>
        <a-form-item name="content" label="规程正文" :rules="contentRules"><ContentEditor v-model:value="form.content" :disabled="saving" @uploading-change="imageUploading = $event" /></a-form-item>
        <a-form-item name="contentUrl" label="规程文件 / 参考链接（可选）" :rules="urlRules"><a-input v-model:value="form.contentUrl" :maxlength="255" placeholder="可保留原有 PDF 规程或参考资料地址" /></a-form-item>
        <a-form-item name="status" label="保存状态"><a-select v-model:value="form.status" :options="[{ value: 0, label: '草稿' }, { value: 1, label: '已发布' }]" /></a-form-item>
      </a-form>
    </a-drawer>
    <a-drawer :title="detail ? `规程详情 - ${detail.sopName || '—'}` : '规程详情'" :width="720" :open="Boolean(detail)" @close="detail = undefined">
      <template v-if="detail"><a-descriptions bordered :column="2"><a-descriptions-item v-for="item in detailFields" :key="item.key" :label="item.label">{{ detail[item.key] ?? '—' }}</a-descriptions-item><a-descriptions-item label="规程文件" :span="2"><a v-if="safeContentUrl(detail.contentUrl)" :href="safeContentUrl(detail.contentUrl)" target="_blank" rel="noopener noreferrer">{{ detail.contentUrl }}</a><span v-else>—</span></a-descriptions-item></a-descriptions><a-card title="规程正文" style="margin-top:16px"><div v-if="hasContent(detail.content)" class="production-rich-content" v-html="contentHtml(detail.content)" /><a-empty v-else description="暂无正文" /></a-card></template>
    </a-drawer>
  </PageContainer>
</template>
<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { Alert as AAlert, Button as AButton, Card as ACard, Col as ACol, Descriptions as ADescriptions, DescriptionsItem as ADescriptionsItem, Drawer as ADrawer, Empty as AEmpty, Form as AForm, FormItem as AFormItem, Input as AInput, InputNumber as AInputNumber, Row as ARow, Select as ASelect, Space as ASpace, Statistic as AStatistic, Tag as ATag, Modal, message, type FormInstance } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { AgriVueRowActions, type VueRowActionItem } from '@agri/shared/vue/list'
import ProductionRequestTable, { type ProductionColumn, type ProductionTableAction } from '@/vue/ProductionRequestTable'
import ContentEditor from '@/vue/ContentEditor.vue'
import { PageContainer } from '@/vue/pro'
import { CONTENT_LIMIT, contentHtml, hasContent, normalizeContent, safeContentUrl } from '@/components/richTextContent'
import { createSopLibrary, deleteSopLibrary, getSopLibrary, listSopLibrary, publishSopLibrary, updateSopLibrary, type SopLibraryItem } from '@/api/admin/sop'
import '@/components/ProductionListDense.css'
const typeOptions = [{ value: 'PLANT', label: '种植' }, { value: 'PEST', label: '植保' }, { value: 'HARVEST', label: '采收' }]
const rows = ref<SopLibraryItem[]>([]), total = ref(0), failure = ref('')
const editing = ref<SopLibraryItem | null>(null), editorOpen = ref(false), saving = ref(false), imageUploading = ref(false), detail = ref<SopLibraryItem>()
type SopForm = { [K in keyof SopLibraryItem]?: NonNullable<SopLibraryItem[K]> }
const form = reactive<SopForm>({}), formRef = ref<FormInstance>()
const busy = computed(() => saving.value || imageUploading.value)
const action: { value?: ProductionTableAction | null } = {}
let listEpoch = 0, editorEpoch = 0
const contentRules = [{ max: CONTENT_LIMIT, message: '正文含格式标记最多100000个字符' }, { validator: async (_rule: unknown, value: unknown) => { if (!hasContent(value as string) && !safeContentUrl(form.contentUrl)) throw new Error('请输入规程正文，或提供有效的规程文件链接') } }]
const urlRules = [{ validator: async (_rule: unknown, value: string) => { if (value && !safeContentUrl(value.trim())) throw new Error('请输入完整的 HTTP 或 HTTPS 地址') } }]
const detailFields: Array<{ key: keyof SopLibraryItem; label: string }> = [{ key: 'sopCode', label: '规程编码' }, { key: 'versionNo', label: '版本' }, { key: 'sopType', label: '类型' }, { key: 'cropId', label: '作物ID' }, { key: 'stageSeq', label: '适用阶段' }, { key: 'applicableRegion', label: '适用区域' }, { key: 'publisher', label: '发布人' }, { key: 'status', label: '状态' }]
const columns: ProductionColumn[] = [
  { title: '关键字', dataIndex: 'keyword', hideInTable: true, fieldProps: { placeholder: '名称或编码' } },
  { title: '规程编码', dataIndex: 'sopCode', width: 160, hideInSearch: true },
  { title: '规程名称', dataIndex: 'sopName', width: 220, hideInSearch: true },
  { title: '类型', dataIndex: 'sopType', width: 100, hideInSearch: true },
  { title: '版本', dataIndex: 'versionNo', width: 100, hideInSearch: true },
  { title: '适用阶段', dataIndex: 'stageSeq', width: 100, hideInSearch: true },
  { title: '适用区域', dataIndex: 'applicableRegion', width: 160, hideInSearch: true },
  { title: '状态', dataIndex: 'status', width: 100, valueEnum: { '1': '已发布', '0': '草稿' } },
  { title: '操作', key: 'action', width: 160, fixed: 'right', valueType: 'option' },
]
async function load(params: Record<string, any>) {
  const epoch = ++listEpoch; failure.value = ''
  try {
    const result = await listSopLibrary({ keyword: params.keyword, status: params.status == null ? undefined : Number(params.status), pageNum: params.current ?? 1, pageSize: params.pageSize ?? 20 })
    if (epoch === listEpoch) { rows.value = result.list ?? []; total.value = result.total ?? 0 }
    return { data: result.list ?? [], total: result.total ?? 0, success: true }
  } catch (error) { if (epoch === listEpoch) failure.value = error instanceof Error ? error.message : '加载失败'; throw error }
}
async function openEditor(row?: SopLibraryItem) {
  if (busy.value) return
  const epoch = ++editorEpoch
  try {
    const full = row ? await getSopLibrary(row.sopId) : null
    if (epoch !== editorEpoch) return
    for (const key of Object.keys(form)) delete form[key as keyof SopLibraryItem]
    Object.assign(form, full ? Object.fromEntries(Object.entries(full).map(([key, value]) => [key, value ?? undefined])) : { status: 0, versionNo: 'V1.0', sopType: 'PLANT', content: '', contentUrl: '' })
    editing.value = full; editorOpen.value = true; await nextTick(); formRef.value?.clearValidate()
  } catch (error) { message.error(`规程加载失败：${error instanceof Error ? error.message : error}`) }
}
function closeEditor() { if (!busy.value) { editorEpoch++; editorOpen.value = false; editing.value = null } }
async function save() {
  if (busy.value) return
  try { await formRef.value?.validate() } catch { return }
  saving.value = true
  try {
    const payload = { ...form, sopName: form.sopName?.trim(), content: normalizeContent(form.content), contentUrl: form.contentUrl?.trim() || '' }
    const existingId = editing.value?.sopId
    const sopId = existingId ?? await createSopLibrary(payload)
    editing.value = { ...payload, sopId }
    if (existingId) await updateSopLibrary(sopId, payload)
    const saved = await getSopLibrary(sopId)
    if (!saved || saved.sopName !== payload.sopName || (saved.content ?? '') !== payload.content.replace(/\r\n?/g, '\n')) throw new Error('已提交，但正文回读不一致；已保留编辑内容，请重试保存')
    if (detail.value?.sopId === saved.sopId) detail.value = saved
    message.success('SOP规程及正文已保存'); editorOpen.value = false; editing.value = null; await action.value?.reload()
  } catch (error) { message.error(`保存失败：${error instanceof Error ? error.message : error}`) }
  finally { saving.value = false }
}
async function mutate(work: () => Promise<unknown>, text: string) { try { await work(); message.success(text); await action.value?.reload() } catch (error) { message.error(error instanceof Error ? error.message : '操作失败') } }
function actionsFor(raw: Record<string, unknown>): VueRowActionItem[] {
  const row = raw as unknown as SopLibraryItem
  return [
    { key: 'detail', label: '详情', onClick: () => { void getSopLibrary(row.sopId).then(value => { detail.value = value }).catch(error => message.error(error.message)) } },
    { key: 'edit', label: '编辑', onClick: () => { void openEditor(row) } },
    { key: 'publish', label: row.status === 1 ? '下架' : '发布', onClick: () => { void mutate(() => publishSopLibrary(row.sopId, row.status === 1 ? 0 : 1), 'SOP状态已更新') } },
    { key: 'delete', label: '删除', danger: true, onClick: () => { Modal.confirm({ title: `确认删除「${row.sopName ?? row.sopCode}」？`, okButtonProps: { danger: true }, onOk: () => mutate(() => deleteSopLibrary(row.sopId), 'SOP已删除') }) } },
  ]
}
</script>
