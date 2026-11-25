import { defineComponent, ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, type PropType, type VNodeChild } from 'vue';
import { useFormModel } from '../components/vue-form';
import { CameraOutlined } from "@ant-design/icons-vue";
import { Button, Input, Progress, Select, Tag, message } from "../components/vue-ui";
import { infoApi } from '../api';
import { useApp } from '../app-context';
import type { PestResult } from '../types';
import { AiCard, EmptyState, PageTitle, SectionHeading } from '../components/ui';
const CROPS = ['大蒜', '辣椒', '西红柿', '水稻', '小麦', '玉米', '苹果', '番茄', '黄瓜', '草莓'];
const SYMPTOM_PRESETS = ['叶片出现褐色斑点并逐渐扩大', '叶片从叶尖向基部干枯，背面有黑色霉层', '植株矮化，新叶卷曲发黄', '果实表面出现水渍状凹陷斑', '根部发黑，拔起有异味'];

/**
 * 拍照识病虫：原型以症状描述替代真实图像上传，后端返回候选病虫害与概率排序，
 * 明确提示「先小范围验证再全田用药」，避免误判造成药害。
 */
export const PestPage = defineComponent({
  name: "PestPage",
  props: {},
  setup(__props, {
    slots: __slots
  }) {
    const __useApp = useApp();
    const navigate = computed(() => __useApp.navigate);
    const crop = ref('大蒜');
    const setCrop = (next: typeof crop.value | ((previous: typeof crop.value) => typeof crop.value)) => {
      crop.value = typeof next === 'function' ? (next as (previous: typeof crop.value) => typeof crop.value)(crop.value) : next;
    };
    const symptom = ref('');
    const setSymptom = (next: typeof symptom.value | ((previous: typeof symptom.value) => typeof symptom.value)) => {
      symptom.value = typeof next === 'function' ? (next as (previous: typeof symptom.value) => typeof symptom.value)(symptom.value) : next;
    };
    const result = ref<PestResult | null>(null);
    const setResult = (next: PestResult | null | ((previous: PestResult | null) => PestResult | null)) => {
      result.value = typeof next === 'function' ? (next as (previous: PestResult | null) => PestResult | null)(result.value) : next;
    };
    const loading = ref(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const identify = (): void => {
      if (!symptom.value.trim()) {
        message.warning('请先描述症状');
        return;
      }
      setLoading(true);
      infoApi.pestIdentify({
        crop: crop.value,
        symptom: symptom.value.trim()
      }).then(setResult).catch((reason: Error) => message.error(reason.message)).finally(() => setLoading(false));
    };
    return () => {
      const view_navigate = navigate.value;
      const view_crop = crop.value;
      const view_symptom = symptom.value;
      const view_loading = loading.value;
      const view_result = result.value;
      return <div class="page-stack">
      <PageTitle eyebrow="PEST & DISEASE" title="拍照识病虫" description="上传病叶照片或描述症状，AI 给出候选病虫害与概率排序及防治建议 · 识别结果仅供参考，用药前请复核" actions={<Button onClick={() => view_navigate('ai-qa')}>去 AI 问答</Button>} />

      <div class="grid-main-aside">
        <section class="surface-card">
          <SectionHeading kicker="INPUT" title="描述症状" />
          <div class="row" style={{
              gap: "10px",
              marginBottom: "12px"
            }}>
            <span class="small muted">作物</span>
            <Select style={{
                width: "160px"
              }} value={view_crop} onChange={value => setCrop(String(value ?? ''))} options={CROPS.map(item => ({
                value: item,
                label: item
              }))} />
          </div>

          <div class="upload-zone" onClick={() => message.info('演示环境使用文字描述替代图片上传，正式版接入图像识别服务')}>
            <CameraOutlined />
            <strong>点击上传病叶照片</strong>
            <span class="small muted">支持 jpg / png，单张不超过 5MB（演示环境以症状描述代替）</span>
          </div>

          <Input.TextArea rows={4} maxlength={200} showCount style={{
              marginTop: "12px"
            }} value={view_symptom} placeholder="例：大蒜叶片从叶尖开始干枯，湿度大时病部有黑色霉层，近一周连阴雨" onChange={event => setSymptom((event.target as HTMLInputElement).value)} />

          <div class="row" style={{
              gap: "8px",
              flexWrap: 'wrap',
              marginTop: "10px"
            }}>
            {SYMPTOM_PRESETS.map(preset => <button type="button" key={preset} class="chip" onClick={() => setSymptom(preset)}>{preset}</button>)}
          </div>

          <Button type="primary" loading={view_loading} style={{
              marginTop: "14px"
            }} onClick={identify}>
            开始识别
          </Button>

          {view_result && <div style={{
              marginTop: "20px"
            }}>
              <SectionHeading kicker="RESULT" title="识别结果" />
              <div class="stack" style={{
                gap: "10px"
              }}>
                {view_result.candidates.map((item, index) => <div class="surface-card flat" key={item.name}>
                    <div class="row between">
                      <b style={{
                      fontSize: "13px"
                    }}>
                        {index === 0 && <Tag class="soft-tag tone-up">最可能</Tag>} {item.name}
                      </b>
                      <b class="small">{item.probability}%</b>
                    </div>
                    <Progress percent={item.probability} showInfo={false} strokeColor={index === 0 ? '#c62828' : '#2d8f4e'} />
                    <p class="small muted" style={{
                    marginTop: "6px"
                  }}>{item.note}</p>
                  </div>)}
              </div>

              <AiCard title="防治建议" confidence={view_result.candidates[0]?.probability ?? 0} actions={view_result.expertAvailable ? <Button size="small" onClick={() => view_navigate('expert')}>转人工专家复核</Button> : undefined}>
                {view_result.advice}
              </AiCard>

              <p class="source-note">
                识别编号 {view_result.qaNo} · 作物 {view_result.crop} · 结果已记入我的提问记录，可在 AI 问答页回看。
              </p>
            </div>}

          {!view_result && <EmptyState icon="🔬" title="等待识别" description="填写作物与症状后点击「开始识别」，通常 3 秒内返回结果。" />}
        </section>

        <div class="stack">
          <section class="surface-card">
            <SectionHeading kicker="HOW IT WORKS" title="识别流程" />
            <ol class="step-list">
              <li><b>图像/症状归一</b>：把描述映射到知识库标准症状词表。</li>
              <li><b>候选检索</b>：按作物 + 症状匹配病虫害条目并计算相似度。</li>
              <li><b>概率排序</b>：输出 Top N 候选与置信度，避免单一结论误导。</li>
              <li><b>处置建议</b>：给出农业防治、生物防治、化学防治的优先顺序。</li>
            </ol>
          </section>

          <section class="surface-card">
            <SectionHeading kicker="SAFETY" title="用药提醒" />
            <ul class="safety-list">
              <li>先小范围试喷 24-48 小时，确认无药害后再全田使用。</li>
              <li>严格按标签剂量，不随意混配、加量。</li>
              <li>采收前注意安全间隔期，避免农残超标。</li>
              <li>连阴雨前后优先做好排水与通风，减少病害流行。</li>
            </ul>
          </section>
        </div>
      </div>
    </div>;
    };
  }
});
