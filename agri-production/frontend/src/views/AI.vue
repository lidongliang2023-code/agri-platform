<template>
  <div class="ai-page">
    <div class="page-header">
      <h2>AI智能助手</h2>
    </div>

    <div class="function-grid">
      <el-card class="function-card" @click="selectFunction('diagnosis')">
        <div class="function-icon disease">
          <el-icon><component :is="icons.Microscope" /></el-icon>
        </div>
        <div class="function-info">
          <h3>病虫害诊断</h3>
          <p>基于图像识别病虫害类型，提供防治建议</p>
        </div>
      </el-card>
      <el-card class="function-card" @click="selectFunction('yield')">
        <div class="function-icon yield">
          <el-icon><component :is="icons.TrendingUp" /></el-icon>
        </div>
        <div class="function-info">
          <h3>产量预测</h3>
          <p>基于历史数据和环境因素预测作物产量</p>
        </div>
      </el-card>
      <el-card class="function-card" @click="selectFunction('input')">
        <div class="function-icon input">
          <el-icon><component :is="icons.Package" /></el-icon>
        </div>
        <div class="function-info">
          <h3>投入品推荐</h3>
          <p>根据作物类型和生长阶段推荐最佳投入品</p>
        </div>
      </el-card>
      <el-card class="function-card" @click="selectFunction('soil')">
        <div class="function-icon soil">
          <el-icon><component :is="icons.Mountain" /></el-icon>
        </div>
        <div class="function-info">
          <h3>土壤分析</h3>
          <p>分析土壤成分，提供改良建议</p>
        </div>
      </el-card>
      <el-card class="function-card" @click="selectFunction('weather')">
        <div class="function-icon weather">
          <el-icon><component :is="icons.CloudSun" /></el-icon>
        </div>
        <div class="function-info">
          <h3>天气预警</h3>
          <p>结合气象数据提供灾害预警和应对建议</p>
        </div>
      </el-card>
      <el-card class="function-card" @click="selectFunction('chat')">
        <div class="function-icon chat">
          <el-icon><component :is="icons.MessageSquare" /></el-icon>
        </div>
        <div class="function-info">
          <h3>智能问答</h3>
          <p>自然语言交互，解答农业生产问题</p>
        </div>
      </el-card>
    </div>

    <el-card v-if="activeFunction" class="detail-card">
      <div class="detail-header">
        <h3>{{ getFunctionTitle(activeFunction) }}</h3>
        <el-button @click="activeFunction = null">返回</el-button>
      </div>

      <div v-if="activeFunction === 'diagnosis'" class="function-detail">
        <div class="upload-section">
          <h4>上传病虫害图片</h4>
          <el-upload
            class="upload-demo"
            action="#"
            :auto-upload="false"
            :on-change="handleImageChange"
          >
            <el-button type="primary">
              <el-icon><component :is="icons.Upload" /></el-icon>
              选择图片
            </el-button>
          </el-upload>
          <div v-if="uploadedImage" class="preview">
            <img :src="uploadedImage" alt="上传图片" />
          </div>
        </div>
        <el-button type="primary" @click="runDiagnosis" :disabled="!uploadedImage">
          <el-icon><component :is="icons.Cpu" /></el-icon>
          开始诊断
        </el-button>
        <div v-if="diagnosisResult" class="result-section">
          <h4>诊断结果</h4>
          <el-card>
            <div class="result-item">
              <span class="label">病害名称：</span>
              <span class="value">{{ diagnosisResult.diseaseName }}</span>
            </div>
            <div class="result-item">
              <span class="label">置信度：</span>
              <span class="value">{{ diagnosisResult.confidence }}%</span>
            </div>
            <div class="result-item">
              <span class="label">症状描述：</span>
              <span class="value">{{ diagnosisResult.description }}</span>
            </div>
            <div class="result-item">
              <span class="label">防治建议：</span>
              <span class="value">{{ diagnosisResult.suggestion }}</span>
            </div>
          </el-card>
        </div>
      </div>

      <div v-else-if="activeFunction === 'yield'" class="function-detail">
        <el-form :model="yieldForm" label-width="100px">
          <el-form-item label="作物类型">
            <el-select v-model="yieldForm.cropType">
              <el-option label="番茄" value="番茄" />
              <el-option label="黄瓜" value="黄瓜" />
              <el-option label="草莓" value="草莓" />
              <el-option label="西瓜" value="西瓜" />
            </el-select>
          </el-form-item>
          <el-form-item label="种植面积(亩)">
            <el-input v-model.number="yieldForm.area" type="number" />
          </el-form-item>
          <el-form-item label="种植日期">
            <el-date-picker v-model="yieldForm.plantDate" type="date" />
          </el-form-item>
          <el-form-item label="当前生长阶段">
            <el-select v-model="yieldForm.growthStage">
              <el-option label="苗期" value="seedling" />
              <el-option label="生长期" value="growing" />
              <el-option label="成熟期" value="mature" />
            </el-select>
          </el-form-item>
          <el-button type="primary" @click="predictYield">
            <el-icon><component :is="icons.Cpu" /></el-icon>
            预测产量
          </el-button>
        </el-form>
        <div v-if="yieldResult" class="result-section">
          <h4>预测结果</h4>
          <el-card>
            <div class="result-item">
              <span class="label">预测产量：</span>
              <span class="value highlight">{{ yieldResult.predictedYield }} 公斤</span>
            </div>
            <div class="result-item">
              <span class="label">预测范围：</span>
              <span class="value">{{ yieldResult.minYield }} - {{ yieldResult.maxYield }} 公斤</span>
            </div>
            <div class="result-item">
              <span class="label">置信区间：</span>
              <span class="value">{{ yieldResult.confidence }}%</span>
            </div>
            <div class="result-item">
              <span class="label">影响因素：</span>
              <span class="value">{{ yieldResult.factors }}</span>
            </div>
          </el-card>
        </div>
      </div>

      <div v-else-if="activeFunction === 'input'" class="function-detail">
        <el-form :model="inputForm" label-width="100px">
          <el-form-item label="作物类型">
            <el-select v-model="inputForm.cropType">
              <el-option label="番茄" value="番茄" />
              <el-option label="黄瓜" value="黄瓜" />
              <el-option label="草莓" value="草莓" />
            </el-select>
          </el-form-item>
          <el-form-item label="生长阶段">
            <el-select v-model="inputForm.growthStage">
              <el-option label="播种期" value="sowing" />
              <el-option label="苗期" value="seedling" />
              <el-option label="生长期" value="growing" />
              <el-option label="开花期" value="flowering" />
              <el-option label="结果期" value="fruiting" />
            </el-select>
          </el-form-item>
          <el-form-item label="目标">
            <el-select v-model="inputForm.objective">
              <el-option label="增产" value="increase" />
              <el-option label="抗病" value="disease" />
              <el-option label="品质提升" value="quality" />
            </el-select>
          </el-form-item>
          <el-button type="primary" @click="getInputRecommendation">
            <el-icon><component :is="icons.Cpu" /></el-icon>
            获取推荐
          </el-button>
        </el-form>
        <div v-if="inputResult" class="result-section">
          <h4>推荐结果</h4>
          <el-table :data="inputResult.recommendations" border>
            <el-table-column prop="name" label="投入品名称" />
            <el-table-column prop="type" label="类型" />
            <el-table-column prop="dosage" label="用量" />
            <el-table-column prop="frequency" label="使用频率" />
            <el-table-column prop="effect" label="预期效果" />
          </el-table>
        </div>
      </div>

      <div v-else-if="activeFunction === 'soil'" class="function-detail">
        <el-form :model="soilForm" label-width="100px">
          <el-form-item label="地块">
            <el-select v-model="soilForm.plotId">
              <el-option label="A区-01" value="1" />
              <el-option label="A区-02" value="2" />
              <el-option label="B区-01" value="3" />
            </el-select>
          </el-form-item>
          <el-button type="primary" @click="analyzeSoil">
            <el-icon><component :is="icons.Cpu" /></el-icon>
            分析土壤
          </el-button>
        </el-form>
        <div v-if="soilResult" class="result-section">
          <h4>分析结果</h4>
          <el-card>
            <div class="soil-chart">
              <div v-for="item in soilResult.components" :key="item.name" class="soil-bar">
                <div class="bar-label">{{ item.name }}</div>
                <div class="bar-container">
                  <div class="bar-fill" :style="{ width: item.value + '%' }"></div>
                </div>
                <div class="bar-value">{{ item.value }}%</div>
              </div>
            </div>
            <h5>改良建议</h5>
            <p>{{ soilResult.suggestion }}</p>
          </el-card>
        </div>
      </div>

      <div v-else-if="activeFunction === 'weather'" class="function-detail">
        <el-form :model="weatherForm" label-width="100px">
          <el-form-item label="地区">
            <el-select v-model="weatherForm.region">
              <el-option label="山东省" value="shandong" />
              <el-option label="河南省" value="henan" />
              <el-option label="江苏省" value="jiangsu" />
            </el-select>
          </el-form-item>
          <el-button type="primary" @click="getWeatherAlert">
            <el-icon><component :is="icons.Cpu" /></el-icon>
            获取预警
          </el-button>
        </el-form>
        <div v-if="weatherResult" class="result-section">
          <h4>天气预警信息</h4>
          <el-card>
            <div class="weather-alert" v-for="alert in weatherResult.alerts" :key="alert.type">
              <el-tag :type="alert.level === 'high' ? 'danger' : 'warning'" class="alert-tag">
                {{ alert.level === 'high' ? '高风险' : '中等风险' }}
              </el-tag>
              <span class="alert-type">{{ alert.type }}</span>
              <span class="alert-desc">{{ alert.description }}</span>
              <span class="alert-suggest">{{ alert.suggestion }}</span>
            </div>
          </el-card>
        </div>
      </div>

      <div v-else-if="activeFunction === 'chat'" class="function-detail">
        <div class="chat-container">
          <div class="chat-messages">
            <div v-for="msg in chatMessages" :key="msg.id" :class="['message', msg.type]">
              <div class="avatar">
                <el-icon v-if="msg.type === 'user'"><component :is="icons.User" /></el-icon>
                <el-icon v-else><component :is="icons.Bot" /></el-icon>
              </div>
              <div class="message-content">{{ msg.content }}</div>
            </div>
          </div>
          <div class="chat-input">
            <el-input v-model="chatInput" @keyup.enter="sendMessage" placeholder="输入您的问题..." />
            <el-button type="primary" @click="sendMessage">
              <el-icon><component :is="icons.Send" /></el-icon>
              发送
            </el-button>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import * as icons from '@element-plus/icons-vue'

const activeFunction = ref(null)
const uploadedImage = ref('')
const diagnosisResult = ref(null)
const yieldResult = ref(null)
const inputResult = ref(null)
const soilResult = ref(null)
const weatherResult = ref(null)
const chatMessages = ref([
  { id: 1, type: 'bot', content: '您好！我是您的AI农业助手，请问有什么可以帮助您的？' }
])
const chatInput = ref('')

const yieldForm = reactive({ cropType: '', area: null, plantDate: '', growthStage: '' })
const inputForm = reactive({ cropType: '', growthStage: '', objective: '' })
const soilForm = reactive({ plotId: '' })
const weatherForm = reactive({ region: '' })

const functionTitles = {
  diagnosis: '病虫害诊断',
  yield: '产量预测',
  input: '投入品推荐',
  soil: '土壤分析',
  weather: '天气预警',
  chat: '智能问答'
}

const getFunctionTitle = (func) => functionTitles[func] || ''

const selectFunction = (func) => {
  activeFunction.value = func
}

const handleImageChange = (file) => {
  uploadedImage.value = URL.createObjectURL(file.raw)
}

const runDiagnosis = () => {
  diagnosisResult.value = {
    diseaseName: '番茄晚疫病',
    confidence: 92,
    description: '叶片出现暗绿色水渍状斑点，逐渐扩大并变为褐色。湿度高时，叶背会产生白色霉层。',
    suggestion: '1. 及时清除病叶并销毁；2. 使用代森锰锌或甲霜灵锰锌进行喷雾防治；3. 加强通风降湿。'
  }
}

const predictYield = () => {
  yieldResult.value = {
    predictedYield: 15600,
    minYield: 14200,
    maxYield: 17000,
    confidence: 88,
    factors: '当前光照充足，但近期降雨量偏少，建议适当增加灌溉频率。'
  }
}

const getInputRecommendation = () => {
  inputResult.value = {
    recommendations: [
      { name: '复合肥NPK 15-15-15', type: '肥料', dosage: '每亩20公斤', frequency: '每两周一次', effect: '促进植株生长' },
      { name: '磷酸二氢钾', type: '叶面肥', dosage: '稀释800倍', frequency: '每周一次', effect: '促进开花结果' },
      { name: '生物有机肥', type: '有机肥', dosage: '每亩50公斤', frequency: '每月一次', effect: '改善土壤结构' }
    ]
  }
}

const analyzeSoil = () => {
  soilResult.value = {
    components: [
      { name: '有机质', value: 2.8 },
      { name: '氮', value: 1.2 },
      { name: '磷', value: 0.8 },
      { name: '钾', value: 2.1 },
      { name: 'pH值', value: 6.5 }
    ],
    suggestion: '土壤整体状况良好，建议适当补充磷肥以促进根系发育。pH值适宜，无需调整。'
  }
}

const getWeatherAlert = () => {
  weatherResult.value = {
    alerts: [
      { type: '高温预警', level: 'high', description: '未来3天最高气温将达到35度以上', suggestion: '建议在早晚时段进行灌溉，避免正午高温作业' },
      { type: '干旱预警', level: 'medium', description: '连续10天无有效降雨', suggestion: '增加灌溉频率，注意土壤墒情监测' }
    ]
  }
}

const sendMessage = () => {
  if (!chatInput.value.trim()) return
  chatMessages.value.push({ id: Date.now(), type: 'user', content: chatInput.value })
  chatInput.value = ''
  setTimeout(() => {
    chatMessages.value.push({ id: Date.now() + 1, type: 'bot', content: '这是一个很好的问题！根据您的情况，建议您参考相关的农业技术资料，或者咨询专业的农艺师获取更详细的建议。' })
  }, 1000)
}
</script>

<style scoped>
.ai-page { padding: 20px; }
.page-header { margin-bottom: 20px; }
.function-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.function-card { cursor: pointer; display: flex; align-items: center; gap: 16px; padding: 20px; transition: all 0.3s; }
.function-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.function-icon { width: 60px; height: 60px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: white; }
.function-icon.disease { background: linear-gradient(135deg, #F56C6C, #F89898); }
.function-icon.yield { background: linear-gradient(135deg, #67C23A, #85CE61); }
.function-icon.input { background: linear-gradient(135deg, #409EFF, #67B8F8); }
.function-icon.soil { background: linear-gradient(135deg, #E6A23C, #F0C78A); }
.function-icon.weather { background: linear-gradient(135deg, #909399, #B4BCCC); }
.function-icon.chat { background: linear-gradient(135deg, #13C2C2, #36D8D8); }
.function-info h3 { margin: 0 0 8px 0; font-size: 16px; }
.function-info p { margin: 0; font-size: 13px; color: #909399; }
.detail-card { margin-top: 20px; }
.detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.function-detail { padding: 20px; }
.upload-section { margin-bottom: 20px; }
.preview { margin-top: 16px; max-width: 300px; }
.preview img { width: 100%; border-radius: 8px; }
.result-section { margin-top: 20px; }
.result-item { margin-bottom: 12px; }
.result-item .label { color: #909399; }
.result-item .value { color: #303133; }
.result-item .highlight { font-size: 24px; font-weight: 600; color: #67C23A; }
.soil-chart { margin-bottom: 16px; }
.soil-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.bar-label { width: 60px; }
.bar-container { flex: 1; height: 20px; background: #f0f0f0; border-radius: 10px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, #409EFF, #67B8F8); border-radius: 10px; }
.bar-value { width: 60px; text-align: right; }
.weather-alert { padding: 12px; border-bottom: 1px solid #f0f0f0; }
.weather-alert:last-child { border-bottom: none; }
.alert-tag { margin-right: 12px; }
.alert-type { font-weight: 600; margin-right: 12px; }
.alert-desc { color: #606266; margin-right: 12px; }
.alert-suggest { color: #67C23A; font-size: 13px; }
.chat-container { display: flex; flex-direction: column; height: 400px; border: 1px solid #e4e7ed; border-radius: 8px; overflow: hidden; }
.chat-messages { flex: 1; padding: 16px; overflow-y: auto; }
.message { display: flex; gap: 12px; margin-bottom: 16px; }
.message.user { justify-content: flex-end; }
.message.user .message-content { background: #409EFF; color: white; border-radius: 12px 0 12px 12px; }
.message.bot { justify-content: flex-start; }
.message.bot .message-content { background: #f5f7fa; border-radius: 0 12px 12px 12px; }
.avatar { width: 36px; height: 36px; border-radius: 50%; background: #e4e7ed; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.message-content { max-width: 70%; padding: 12px 16px; font-size: 14px; }
.chat-input { display: flex; gap: 12px; padding: 12px; border-top: 1px solid #e4e7ed; }
.chat-input .el-input { flex: 1; }
</style>