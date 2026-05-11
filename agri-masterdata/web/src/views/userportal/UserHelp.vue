<template>
  <div class="user-help">
    <div class="page-header">
      <h1>帮助中心</h1>
      <p>查找常见问题解答和使用指南</p>
    </div>

    <div class="search-section">
      <div class="search-box">
        <input 
          type="text" 
          v-model="searchKeyword" 
          placeholder="搜索帮助文档..." 
          class="search-input"
          @keyup.enter="handleSearch"
        />
        <button class="search-btn" @click="handleSearch">🔍</button>
      </div>
    </div>

    <div class="help-content">
      <div class="help-sidebar">
        <h3>帮助分类</h3>
        <ul class="category-list">
          <li 
            v-for="cat in categories" 
            :key="cat.key"
            :class="{ active: activeCategory === cat.key }"
            @click="activeCategory = cat.key"
          >
            <span class="cat-icon">{{ cat.icon }}</span>
            <span>{{ cat.label }}</span>
          </li>
        </ul>
      </div>

      <div class="help-main">
        <div class="article-list" v-if="activeCategory !== 'contact'">
          <h3>{{ currentCategoryLabel }}</h3>
          <div v-for="article in filteredArticles" :key="article.id" class="article-card" @click="viewArticle(article)">
            <div class="article-header">
              <h4>{{ article.title }}</h4>
              <span class="article-date">{{ article.date }}</span>
            </div>
            <p class="article-preview">{{ article.preview }}</p>
            <div class="article-tags">
              <span v-for="tag in article.tags" :key="tag" class="tag">{{ tag }}</span>
            </div>
          </div>
        </div>

        <div class="contact-section" v-else>
          <h3>联系我们</h3>
          <div class="contact-info">
            <div class="contact-item">
              <span class="contact-icon">📧</span>
              <div>
                <span class="contact-label">邮箱支持</span>
                <span class="contact-value">support@example.com</span>
              </div>
            </div>
            <div class="contact-item">
              <span class="contact-icon">📞</span>
              <div>
                <span class="contact-label">服务热线</span>
                <span class="contact-value">400-888-8888</span>
              </div>
            </div>
            <div class="contact-item">
              <span class="contact-icon">🕐</span>
              <div>
                <span class="contact-label">服务时间</span>
                <span class="contact-value">周一至周五 9:00-18:00</span>
              </div>
            </div>
          </div>

          <div class="feedback-form">
            <h4>提交反馈</h4>
            <form @submit.prevent="submitFeedback">
              <div class="form-group">
                <label>反馈类型</label>
                <select v-model="feedbackForm.type" class="form-select">
                  <option value="bug">问题反馈</option>
                  <option value="feature">功能建议</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div class="form-group">
                <label>反馈标题</label>
                <input type="text" v-model="feedbackForm.title" class="form-input" placeholder="请输入反馈标题" />
              </div>
              <div class="form-group">
                <label>详细描述</label>
                <textarea v-model="feedbackForm.content" class="form-textarea" placeholder="请详细描述您的问题或建议"></textarea>
              </div>
              <button type="submit" class="submit-btn">提交反馈</button>
            </form>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-overlay" v-if="articleVisible" @click="articleVisible = false">
      <div class="modal-content article-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ selectedArticle?.title }}</h3>
          <button class="close-btn" @click="articleVisible = false">×</button>
        </div>
        <div class="modal-body" v-if="selectedArticle">
          <div class="article-content">
            <div class="article-meta">
              <span>发布时间: {{ selectedArticle.date }}</span>
              <span>浏览次数: {{ selectedArticle.views }}</span>
            </div>
            <div class="article-body" v-html="selectedArticle.content"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="articleVisible = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const searchKeyword = ref('')
const activeCategory = ref('getting-started')
const articleVisible = ref(false)
const selectedArticle = ref(null)

const feedbackForm = reactive({
  type: 'bug',
  title: '',
  content: ''
})

const categories = [
  { key: 'getting-started', label: '快速入门', icon: '🚀' },
  { key: 'data-query', label: '数据查询', icon: '🔍' },
  { key: 'report', label: '报表功能', icon: '📊' },
  { key: 'api', label: 'API使用', icon: '🔌' },
  { key: 'faq', label: '常见问题', icon: '❓' },
  { key: 'contact', label: '联系我们', icon: '📞' }
]

const articles = {
  'getting-started': [
    { 
      id: 1, 
      title: '如何注册并登录系统', 
      preview: '本文介绍如何注册账号并登录主数据管理系统...',
      date: '2026-05-01',
      tags: ['注册', '登录'],
      views: 1256,
      content: '<h4>注册账号</h4><p>1. 访问系统首页，点击"注册"按钮</p><p>2. 填写用户名、邮箱和密码</p><p>3. 点击"提交"完成注册</p><h4>登录系统</h4><p>1. 在登录页面输入账号密码</p><p>2. 点击"登录"按钮</p><p>3. 成功登录后进入用户首页</p>'
    },
    { 
      id: 2, 
      title: '系统界面概览', 
      preview: '了解系统的主要界面和功能模块...',
      date: '2026-05-02',
      tags: ['界面', '导航'],
      views: 892,
      content: '<h4>顶部导航</h4><p>包含系统logo、导航菜单和用户信息</p><h4>左侧菜单</h4><p>包含所有功能模块的入口</p><h4>主内容区</h4><p>显示当前页面的内容</p>'
    },
    { 
      id: 3, 
      title: '个人信息设置', 
      preview: '如何修改个人信息和密码...',
      date: '2026-05-03',
      tags: ['个人信息', '密码'],
      views: 654,
      content: '<h4>修改个人信息</h4><p>1. 点击右上角用户头像</p><p>2. 选择"个人中心"</p><p>3. 修改个人信息后保存</p><h4>修改密码</h4><p>1. 进入账号设置</p><p>2. 输入原密码和新密码</p><p>3. 点击"确认修改"</p>'
    }
  ],
  'data-query': [
    { 
      id: 4, 
      title: '如何查询用户数据', 
      preview: '详细介绍用户数据查询功能的使用方法...',
      date: '2026-05-04',
      tags: ['用户数据', '查询'],
      views: 1534,
      content: '<h4>进入查询页面</h4><p>1. 点击导航栏的"数据查询"</p><p>2. 选择"用户数据"标签</p><h4>使用筛选条件</h4><p>1. 选择查询字段类型</p><p>2. 输入关键词</p><p>3. 点击"搜索"按钮</p>'
    },
    { 
      id: 5, 
      title: '数据导出功能', 
      preview: '如何导出查询结果为Excel文件...',
      date: '2026-05-05',
      tags: ['导出', 'Excel'],
      views: 987,
      content: '<h4>导出数据</h4><p>1. 在查询结果页面</p><p>2. 点击"导出数据"按钮</p><p>3. 选择导出格式</p><p>4. 文件自动下载</p>'
    }
  ],
  'report': [
    { 
      id: 6, 
      title: '查看数据质量报告', 
      preview: '了解如何查看和分析数据质量报告...',
      date: '2026-05-06',
      tags: ['质量报告', '数据分析'],
      views: 723,
      content: '<h4>查看报告</h4><p>1. 点击导航栏的"数据报表"</p><p>2. 选择"质量报告"标签</p><h4>报告内容</h4><p>包含检测记录数、异常记录数、合格率等关键指标</p>'
    },
    { 
      id: 7, 
      title: '自定义报表', 
      preview: '如何创建和自定义数据报表...',
      date: '2026-05-07',
      tags: ['自定义', '报表'],
      views: 456,
      content: '<h4>创建报表</h4><p>1. 进入报表管理页面</p><p>2. 点击"新建报表"</p><p>3. 配置报表参数</p><p>4. 保存并生成报表</p>'
    }
  ],
  'api': [
    { 
      id: 8, 
      title: 'API接口文档', 
      preview: '系统API接口的详细说明...',
      date: '2026-05-08',
      tags: ['API', '接口'],
      views: 1123,
      content: '<h4>接口地址</h4><p>基础URL: https://api.example.com/v1</p><h4>认证方式</h4><p>使用Bearer Token进行认证</p><h4>接口列表</h4><p>GET /users - 获取用户列表</p><p>GET /users/{id} - 获取用户详情</p>'
    },
    { 
      id: 9, 
      title: 'API调用示例', 
      preview: '使用curl和Python调用API的示例...',
      date: '2026-05-09',
      tags: ['示例', '代码'],
      views: 876,
      content: '<h4>curl示例</h4><p>curl -H "Authorization: Bearer token" https://api.example.com/v1/users</p><h4>Python示例</h4><p>import requests</p><p>headers = {"Authorization": "Bearer token"}</p><p>response = requests.get(url, headers=headers)</p>'
    }
  ],
  'faq': [
    { 
      id: 10, 
      title: '忘记密码怎么办', 
      preview: '忘记密码时的找回方法...',
      date: '2026-05-10',
      tags: ['密码', '找回'],
      views: 2345,
      content: '<h4>找回密码</h4><p>1. 在登录页面点击"忘记密码"</p><p>2. 输入注册邮箱</p><p>3. 查收重置密码邮件</p><p>4. 点击链接重置密码</p>'
    },
    { 
      id: 11, 
      title: '如何获取更多数据权限', 
      preview: '申请数据访问权限的流程...',
      date: '2026-05-11',
      tags: ['权限', '申请'],
      views: 567,
      content: '<h4>申请权限</h4><p>1. 联系系统管理员</p><p>2. 说明需要访问的数据范围</p><p>3. 等待审批通过</p>'
    },
    { 
      id: 12, 
      title: '数据查询很慢怎么办', 
      preview: '优化查询性能的方法...',
      date: '2026-05-12',
      tags: ['性能', '优化'],
      views: 342,
      content: '<h4>优化建议</h4><p>1. 添加更多筛选条件</p><p>2. 使用分页功能</p><p>3. 避免查询全部字段</p><p>4. 联系管理员优化索引</p>'
    }
  ]
}

const currentCategoryLabel = computed(() => {
  const cat = categories.find(c => c.key === activeCategory.value)
  return cat?.label || ''
})

const filteredArticles = computed(() => {
  let result = articles[activeCategory.value] || []
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(article => 
      article.title.toLowerCase().includes(keyword) ||
      article.preview.toLowerCase().includes(keyword) ||
      article.tags.some(tag => tag.toLowerCase().includes(keyword))
    )
  }
  return result
})

const handleSearch = () => {}

const viewArticle = (article) => {
  selectedArticle.value = article
  articleVisible.value = true
}

const submitFeedback = () => {
  if (!feedbackForm.title || !feedbackForm.content) {
    alert('请填写完整的反馈信息')
    return
  }
  alert('反馈已提交，感谢您的反馈！')
  feedbackForm.title = ''
  feedbackForm.content = ''
}

onMounted(() => {})
</script>

<style scoped>
.user-help {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.page-header p {
  font-size: 14px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.search-section {
  margin-bottom: 24px;
}

.search-box {
  display: flex;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.search-input {
  flex: 1;
  padding: 16px 20px;
  border: none;
  font-size: 14px;
  outline: none;
}

.search-btn {
  padding: 0 24px;
  background: #238636;
  color: #fff;
  border: none;
  font-size: 18px;
  cursor: pointer;
}

.help-content {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 24px;
}

.help-sidebar {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.help-sidebar h3 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 16px;
}

.category-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.category-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  font-size: 14px;
  color: #4a5568;
}

.category-list li:hover {
  background: #f8fafc;
}

.category-list li.active {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.cat-icon {
  font-size: 16px;
}

.help-main {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.help-main h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 16px;
}

.article-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.article-card {
  padding: 20px;
  background: #f8fafc;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.article-card:hover {
  background: #f0fdf4;
  transform: translateY(-2px);
}

.article-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.article-header h4 {
  font-size: 15px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.article-date {
  font-size: 12px;
  color: #a0aec0;
}

.article-preview {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 12px;
  line-height: 1.5;
}

.article-tags {
  display: flex;
  gap: 8px;
}

.tag {
  font-size: 11px;
  padding: 4px 10px;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  border-radius: 12px;
}

.contact-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.contact-info {
  display: flex;
  gap: 20px;
}

.contact-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 10px;
}

.contact-icon {
  font-size: 28px;
}

.contact-item div {
  display: flex;
  flex-direction: column;
}

.contact-label {
  font-size: 12px;
  color: #a0aec0;
}

.contact-value {
  font-size: 14px;
  font-weight: 500;
  color: #2d3748;
}

.feedback-form {
  padding: 20px;
  background: #f8fafc;
  border-radius: 10px;
}

.feedback-form h4 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  color: #4a5568;
  margin-bottom: 6px;
}

.form-select {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.form-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  min-height: 100px;
  resize: vertical;
  box-sizing: border-box;
}

.submit-btn {
  padding: 10px 24px;
  background: #238636;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
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
  width: 700px;
  max-width: 90%;
  max-height: 80vh;
  overflow: hidden;
}

.article-modal {
  max-height: 80vh;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #a0aec0;
  cursor: pointer;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  max-height: 60vh;
}

.article-meta {
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #a0aec0;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.article-body {
  font-size: 14px;
  color: #2d3748;
  line-height: 1.8;
}

.article-body h4 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 16px 0 8px;
}

.article-body p {
  margin: 8px 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: #238636;
  color: #fff;
}
</style>