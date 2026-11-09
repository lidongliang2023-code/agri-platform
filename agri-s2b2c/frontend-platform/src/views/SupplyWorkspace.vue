<template>
  <div class="supply-workspace">
    <section class="source-toolbar">
      <div><h2>平台供货运营</h2><p>平台统一整合货源、维护商品与供货规则，为渠道提供系统和数据支持。</p></div>
      <div class="source-actions">
        <el-select v-model="sourceId" filterable placeholder="请选择货源档案" :loading="loading" @change="selectSource">
          <el-option v-for="source in sources" :key="source.id" :value="String(source.id)" :label="source.companyName || source.shopName" />
        </el-select>
        <el-button @click="dialogOpen = true">新建货源档案</el-button>
      </div>
    </section>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <el-alert v-if="sourceId" title="当前操作作用于所选货源。切换档案后，商品、授权、履约及收入数据同步切换。" type="info" :closable="false" />
    <router-view v-if="sourceId" :key="sourceId + route.fullPath" />
    <el-empty v-else description="请选择货源档案，或新建平台自营 / 合作企业货源档案" />
    <el-dialog v-model="dialogOpen" title="新建货源档案" width="520px" :close-on-click-modal="false">
      <el-form label-width="110px" @submit.prevent>
        <el-form-item label="货源企业名称" required><el-input v-model="form.companyName" maxlength="100" /></el-form-item>
        <el-form-item label="对外供货名称"><el-input v-model="form.shopName" maxlength="100" /></el-form-item>
        <el-form-item label="联系电话"><el-input v-model="form.contactPhone" maxlength="30" /></el-form-item>
        <el-form-item label="货源地址"><el-input v-model="form.address" maxlength="255" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogOpen = false">取消</el-button><el-button type="primary" :loading="saving" @click="createSource">保存档案</el-button></template>
    </el-dialog>
  </div>
</template>
<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '../api'
const route = useRoute()
const sources = ref([])
const sourceId = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const dialogOpen = ref(false)
const form = reactive({ companyName: '', shopName: '', contactPhone: '', address: '' })
const key = 's2b2c-platform-supply-source'
function selectSource(value) { sessionStorage.setItem(key, String(value)) }
async function load() {
  loading.value = true
  error.value = ''
  try {
    sources.value = await api.get('/platform/supply-sources')
    const saved = sessionStorage.getItem(key)
    sourceId.value = sources.value.some(item => String(item.id) === saved) ? saved : ''
    if (!sourceId.value) sessionStorage.removeItem(key)
  } catch (e) { error.value = e?.response?.data?.message || '货源档案加载失败' }
  finally { loading.value = false }
}
async function createSource() {
  if (!form.companyName.trim()) return ElMessage.warning('请填写货源企业名称')
  saving.value = true
  try {
    const result = await api.post('/platform/supply-sources', form)
    if (!result.success) throw new Error(result.message)
    await load()
    sourceId.value = String(result.id)
    selectSource(sourceId.value)
    dialogOpen.value = false
    Object.assign(form, { companyName: '', shopName: '', contactPhone: '', address: '' })
    ElMessage.success('货源档案已建立')
  } catch (e) { ElMessage.error(e?.response?.data?.message || e.message || '保存失败') }
  finally { saving.value = false }
}
onMounted(load)
</script>
<style scoped>
.supply-workspace { display: flex; flex-direction: column; gap: 16px; }
.source-toolbar { display: flex; justify-content: space-between; gap: 20px; padding: 20px; background: #fff; border: 1px solid #e3eae5; border-radius: 12px; }
h2 { margin: 0 0 8px; font-size: 20px; color: #173e2a; }
p { margin: 0; color: #6b7c72; line-height: 1.6; }
.source-actions { display: flex; align-items: center; gap: 10px; }
.source-actions .el-select { width: 240px; }
@media(max-width: 900px) { .source-toolbar, .source-actions { flex-direction: column; align-items: stretch; } .source-actions .el-select { width: 100%; } }
</style>
