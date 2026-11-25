<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="RULE-BASED TRIAGE"
      title="农事问题初判"
      description="按症状关键词比对平台内置的常见病虫害处置规则，给出风险等级、候选病因与下一步建议；结论写入你的问诊记录，可随时转专家复核。"
    >
      <template #actions>
        <span class="ai-live-badge"><i /> 规则引擎在线</span>
      </template>
    </PageTitle>

    <div class="diagnose-layout">
      <section class="surface-card diagnose-input-card">
        <div class="section-heading compact">
          <div><span class="section-kicker">NEW TRIAGE</span><h2>描述您遇到的问题</h2></div>
          <span class="ai-chip"><RobotOutlined /> 文字初判</span>
        </div>
        <label class="field-label">作物 / 品种</label>
        <div class="form-grid-2">
          <a-select v-model:value="crop" :options="cropOptions" />
          <a-input v-model:value="subject" placeholder="问题主题，如：晚稻叶片红褐色斑点" />
        </div>
        <label class="field-label">症状描述</label>
        <a-textarea
          v-model:value="content"
          :rows="7"
          placeholder="写明发病部位与颜色、出现时间、发生面积、近期天气与用药——这些关键词直接决定初判结果"
        />
        <div class="quick-prompts">
          <button v-for="prompt in quickPrompts" :key="prompt" type="button" @click="appendPrompt(prompt)">{{ prompt }}</button>
        </div>
        <a-button type="primary" size="large" block :loading="loading" @click="diagnose">
          <template #icon><ThunderboltOutlined /></template>
          开始初判
        </a-button>
        <p class="ai-disclaimer"><SafetyCertificateOutlined /> 本版没有接入拍照与视频识别，只依据文字关键词匹配规则；描述越具体，候选病因越贴近。</p>
      </section>

      <section class="diagnose-result-card">
        <div v-if="!result" class="diagnose-empty">
          <span><RobotOutlined /></span>
          <h3>等待症状信息</h3>
          <p>提交后你会拿到风险等级、命中的候选病因，以及是否需要转专家复核。</p>
          <div>
            <small><CheckCircleFilled /> 每次初判都会生成一条问诊记录</small>
            <small><CheckCircleFilled /> 命中关键词才会给出候选病因，否则提示补充信息</small>
            <small><CheckCircleFilled /> 可一键转到专家问诊</small>
          </div>
        </div>
        <div v-else class="diagnose-result">
          <div class="diagnose-result-head">
            <span><RobotOutlined /></span>
            <div><small>初判结果 · {{ result.consultNo }}</small><h2>{{ result.level }}</h2></div>
            <em>{{ result.matchedDiseases.length > 0 ? `命中 ${result.matchedDiseases.length} 个候选` : '信息不足' }}</em>
          </div>
          <div v-if="result.matchedDiseases.length > 0" class="matched-tags">
            <span v-for="item in result.matchedDiseases" :key="item">{{ item }}</span>
          </div>
          <div class="diagnose-suggestion"><b>处置建议</b><p>{{ result.suggestion }}</p></div>
          <div class="diagnose-actions">
            <a-button type="primary" :disabled="!result.expertAvailable" @click="app.navigate('consult')">
              {{ result.expertAvailable ? `转农技专家复核（在册 ${result.expertCount} 位）` : '当前无在册专家' }}
            </a-button>
            <a-button @click="app.navigate('services')">预约植保服务</a-button>
            <a-button @click="app.navigate('consult')"><template #icon><MessageOutlined /></template>查看问诊记录</a-button>
          </div>
          <div class="diagnose-warning">规则初判不能替代农技专家或执业兽医的现场诊断。如出现大面积扩散、畜禽连续死亡，请及时隔离并联系当地农业部门。</div>
        </div>
      </section>
    </div>

    <section class="surface-card detail-section">
      <div class="section-heading compact">
        <div><span class="section-kicker">RULE COVERAGE</span><h2>规则库现在能判什么</h2></div>
        <span class="section-note">按关键词命中，未命中会提示补充信息</span>
      </div>
      <div class="capability-grid">
        <div><span>🌾</span><b>叶部病斑</b><small>含「斑点/褐」→ 稻瘟病、胡麻斑病、细菌性条斑病候选</small></div>
        <div><span>🐛</span><b>虫害迹象</b><small>含「虫/飞」→ 虫量统计与飞防处置建议</small></div>
        <div><span>🍂</span><b>黄化萎蔫</b><small>含「黄/萎」→ 积水、根系损伤与缺素三类排查</small></div>
        <div><span>⚠️</span><b>高风险升级</b><small>含「死亡/大面积/枯萎」→ 直接标高风险并建议转专家</small></div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircleFilled, MessageOutlined, RobotOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { serviceApi } from '../api'
import { useAppStore } from '../app-context'
import type { DiagnoseResult } from '../types'
import PageTitle from '../components/PageTitle.vue'

const cropOptions = ['水稻', '油菜', '柑橘', '蔬菜', '生猪', '家禽'].map((value) => ({ value, label: value }))
const quickPrompts = ['叶片出现红褐色斑点', '根部腐烂', '植株大面积黄化', '发现虫害', '畜禽连续死亡']

const app = useAppStore()
const subject = ref('')
const crop = ref('水稻')
const content = ref('')
const result = ref<DiagnoseResult | null>(null)
const loading = ref(false)

function appendPrompt(prompt: string) {
  content.value = content.value ? `${content.value}\n${prompt}` : prompt
}

async function diagnose() {
  if (!content.value.trim()) {
    message.warning('请先描述症状')
    return
  }
  loading.value = true
  try {
    const diagnosis = await serviceApi.diagnose({
      subject: subject.value.trim() || `${crop.value}田间问题`,
      crop: crop.value,
      content: content.value,
    })
    result.value = diagnosis
    message.success(`初判完成（${diagnosis.consultNo}），已存入问诊记录`)
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : '初判失败')
  } finally {
    loading.value = false
  }
}
</script>
