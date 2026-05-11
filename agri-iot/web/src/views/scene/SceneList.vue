<template>
  <div class="scene-list">
    <div class="page-header">
      <h2>场景管理</h2>
      <button class="add-btn" @click="showAddModal = true">+ 新增场景</button>
    </div>

    <div class="search-bar">
      <input v-model="searchText" placeholder="搜索场景名称" class="search-input" />
      <select v-model="categoryFilter" class="filter-select">
        <option value="">全部分类</option>
        <option value="灌溉">灌溉</option>
        <option value="环境">环境</option>
        <option value="光照">光照</option>
        <option value="通风">通风</option>
      </select>
    </div>

    <div class="scene-grid">
      <div v-for="scene in sceneList" :key="scene.id" class="scene-card">
        <div class="scene-icon">{{ scene.icon }}</div>
        <div class="scene-info">
          <h3>{{ scene.sceneName }}</h3>
          <p>{{ scene.description }}</p>
          <span :class="['category-tag', scene.category]">{{ scene.category }}</span>
        </div>
        <div class="scene-status">
          <span :class="['status-tag', scene.isActive === 1 ? 'active' : 'inactive']">
            {{ scene.isActive === 1 ? '已激活' : '未激活' }}
          </span>
        </div>
        <div class="scene-actions">
          <button v-if="scene.isActive === 1" class="action-btn execute" @click="executeScene(scene)">执行</button>
          <button class="action-btn edit" @click="editScene(scene)">编辑</button>
          <button class="action-btn toggle" @click="toggleScene(scene)">
            {{ scene.isActive === 1 ? '停用' : '启用' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingScene ? '编辑场景' : '新增场景' }}</h3>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        <form class="modal-form" @submit.prevent="saveScene">
          <div class="form-group">
            <label>场景名称 *</label>
            <input v-model="form.sceneName" placeholder="请输入场景名称" />
          </div>
          <div class="form-group">
            <label>场景编码</label>
            <input v-model="form.sceneCode" placeholder="请输入场景编码" />
          </div>
          <div class="form-group">
            <label>场景类型</label>
            <select v-model="form.sceneType">
              <option value="">请选择类型</option>
              <option value="manual">手动触发</option>
              <option value="auto">自动触发</option>
            </select>
          </div>
          <div class="form-group">
            <label>分类</label>
            <select v-model="form.category">
              <option value="">请选择分类</option>
              <option value="灌溉">灌溉</option>
              <option value="环境">环境</option>
              <option value="光照">光照</option>
              <option value="通风">通风</option>
            </select>
          </div>
          <div class="form-group">
            <label>图标</label>
            <input v-model="form.icon" placeholder="输入emoji图标" />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" placeholder="请输入场景描述"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="cancel-btn" @click="closeModal">取消</button>
            <button type="submit" class="submit-btn">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const searchText = ref('')
const categoryFilter = ref('')
const showAddModal = ref(false)
const editingScene = ref(null)

const form = reactive({
  sceneName: '',
  sceneCode: '',
  sceneType: '',
  category: '',
  icon: '',
  description: ''
})

const sceneList = ref([
  { id: 1, sceneCode: 'SCENE001', sceneName: '清晨灌溉', sceneType: 'auto', category: '灌溉', icon: '🌅', description: '每日清晨自动开启灌溉系统', isActive: 1 },
  { id: 2, sceneCode: 'SCENE002', sceneName: '温室降温', sceneType: 'auto', category: '环境', icon: '❄️', description: '温度过高时自动开启降温设备', isActive: 1 },
  { id: 3, sceneCode: 'SCENE003', sceneName: '补光模式', sceneType: 'manual', category: '光照', icon: '💡', description: '手动开启补光灯', isActive: 0 },
  { id: 4, sceneCode: 'SCENE004', sceneName: '通风换气', sceneType: 'auto', category: '通风', icon: '💨', description: '定时开启风机通风', isActive: 1 },
  { id: 5, sceneCode: 'SCENE005', sceneName: '夜间保温', sceneType: 'auto', category: '环境', icon: '🌙', description: '夜间自动开启保温设备', isActive: 0 },
  { id: 6, sceneCode: 'SCENE006', sceneName: '紧急灌溉', sceneType: 'manual', category: '灌溉', icon: '🚨', description: '手动紧急灌溉', isActive: 1 }
])

const executeScene = (scene) => {
  alert(`场景「${scene.sceneName}」已执行`)
}

const editScene = (scene) => {
  editingScene.value = scene
  form.sceneName = scene.sceneName
  form.sceneCode = scene.sceneCode
  form.sceneType = scene.sceneType
  form.category = scene.category
  form.icon = scene.icon
  form.description = scene.description
  showAddModal.value = true
}

const toggleScene = (scene) => {
  scene.isActive = scene.isActive === 1 ? 0 : 1
  alert(`场景「${scene.sceneName}」已${scene.isActive === 1 ? '启用' : '停用'}`)
}

const closeModal = () => {
  showAddModal.value = false
  editingScene.value = null
  form.sceneName = ''
  form.sceneCode = ''
  form.sceneType = ''
  form.category = ''
  form.icon = ''
  form.description = ''
}

const saveScene = () => {
  if (!form.sceneName) {
    alert('请填写场景名称')
    return
  }
  if (editingScene.value) {
    const index = sceneList.value.findIndex(s => s.id === editingScene.value.id)
    if (index > -1) {
      sceneList.value[index] = { ...sceneList.value[index], ...form }
    }
    alert('修改成功')
  } else {
    sceneList.value.push({
      id: Date.now(),
      ...form,
      isActive: 0
    })
    alert('新增成功')
  }
  closeModal()
}
</script>

<style scoped>
.scene-list {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.add-btn {
  background: #4080ff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.search-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.search-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.filter-select {
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.scene-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.scene-icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.scene-info h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.scene-info p {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #666;
}

.category-tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.category-tag.灌溉 { background: #e6f7ff; color: #1890ff; }
.category-tag.环境 { background: #f6ffed; color: #52c41a; }
.category-tag.光照 { background: #fffbe6; color: #faad14; }
.category-tag.通风 { background: #fff0f6; color: #eb2f96; }

.scene-status {
  margin-top: 12px;
  margin-bottom: 16px;
}

.status-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-tag.active { background: #d1fae5; color: #065f46; }
.status-tag.inactive { background: #f3f4f6; color: #6b7280; }

.scene-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 500;
}

.action-btn.execute {
  background: #52c41a;
  color: white;
}

.action-btn.edit {
  background: #f0f0f0;
  color: #666;
}

.action-btn.toggle {
  background: #fffbe6;
  color: #d97706;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  width: 90%;
  max-width: 450px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e8e8e8;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
}

.modal-form {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  margin-bottom: 6px;
}

.form-group input, .form-group select, .form-group textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.form-group textarea {
  min-height: 80px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.cancel-btn {
  padding: 10px 20px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  background: #fff;
  color: #666;
}

.submit-btn {
  padding: 10px 20px;
  background: #4080ff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
</style>