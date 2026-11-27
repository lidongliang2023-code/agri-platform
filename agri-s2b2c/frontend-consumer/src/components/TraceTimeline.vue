<template>
  <div class="trace-wrap">
    <div v-if="invalidCodeLabel" class="code-warning" role="status">
      <span>溯源码 {{ trace.traceCode }}</span>
      <strong>{{ invalidCodeLabel }}</strong>
    </div>
    <EmptyBlock
      v-if="trace.unavailable"
      icon="⚠"
      title="溯源链路暂时连不上生产管理模块"
      :desc="trace.message || '生产管理模块不可达。这不是「该商品没有溯源记录」，请稍后重试。'"
    />
    <EmptyBlock
      v-else-if="!trace.bound"
      icon="🔍"
      :title="emptyTitle"
      :desc="trace.reason || '链路内容由供应商绑定生产管理模块的采收批次后实查展示，商城不代填批次内容。'"
    >
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </EmptyBlock>
    <EmptyBlock
      v-else-if="!trace.matched"
      icon="🔍"
      title="绑定的批次在生产管理模块查不到"
      :desc="trace.reason || '批次可能已被删除或编号填错，请让供应商在商品编辑页重新绑定。'"
    >
      <template v-if="$slots.actions" #actions><slot name="actions" /></template>
    </EmptyBlock>
    <template v-else>
      <div class="trace-head">
        <div>
          <b class="t-batch">批次 {{ trace.batchNo }}</b>
          <span v-if="displayName" class="m-tag">{{ displayName }}</span>
          <span v-if="trace.qualityGrade" class="m-tag">{{ trace.qualityGrade }} 级</span>
          <span v-if="trace.origin" class="m-tag">产地 {{ trace.origin }}</span>
          <span v-if="trace.codeStatus && !invalidCodeLabel" class="m-tag">码状态 {{ codeLabel(trace.codeStatus) }}</span>
        </div>
        <div class="trace-ops">
          <span class="muted small">
            环节齐全度：种植{{ has('planting') ? '✓' : '缺' }} ·
            采收{{ has('harvest') ? '✓' : '缺' }} ·
            加工{{ has('process') ? '✓' : '缺' }}
          </span>
          <a class="m-btn sm" :href="chainDeepLink" target="_blank" rel="noopener">
            在生产管理模块看全链路 ›
          </a>
        </div>
      </div>

      <h3 v-if="invalidCodeLabel && nodes.length" class="history-title">批次历史记录</h3>
      <ol class="trace-timeline">
        <li v-for="n in nodes" :key="n.seq" class="trace-node" :class="{ onchain: n.onChain }">
          <span class="node-dot">{{ n.seq }}</span>
          <div class="node-body">
            <div class="node-hd">
              <b>{{ n.stageName || n.title }}</b>
              <span v-if="n.occurredAt" class="node-time">{{ fmtTime(n.occurredAt) }}</span>
              <span v-if="n.onChain" class="node-chain ok">{{ n.chainType === 'SIMULATED' ? '模拟存证成功' : '存证成功' }}</span>
              <span v-else-if="statusOf(n) === 'PENDING'" class="node-chain pending">存证处理中</span>
              <span v-else-if="statusOf(n) === 'FAILED'" class="node-chain failed">存证失败</span>
              <span v-else-if="n.attested" class="node-chain">存证状态未知</span>
              <span v-else class="node-chain none">未存证</span>
            </div>
            <p class="node-detail">{{ n.detail }}</p>
            <p v-if="n.txHash" class="node-hash">交易号 {{ n.txHash }}</p>
            <p v-if="statusOf(n) === 'FAILED' && n.failedReason" class="node-fail">存证失败原因：{{ n.failedReason }}</p>
          </div>
        </li>
      </ol>

      <div v-if="codes.length" class="trace-codes">
        <span class="muted small">本批次溯源码（{{ codes.length }} 支）：</span>
        <code v-for="c in codes" :key="c.code" class="code-chip">
          {{ c.code }}<em>{{ c.code === trace.traceCode && invalidCodeLabel ? invalidCodeLabel : codeLabel(c.status, c.expired) }}</em>
        </code>
      </div>

      <p class="pane-note">
        链上结论：{{ trace.conclusion }}
        <br>
        数据来源：生产管理模块的采收批次与加工登记（本页只读展示，商城不另存一份溯源数据）。
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { productionChainUrl } from '../config/cross-module'
import EmptyBlock from './EmptyBlock.vue'

/**
 * 溯源链路时间线（商品详情与溯源查询页共用）。
 *
 * <p>抽成一个组件的理由：两处都渲染同一份生产域出参，各写一遍就会各判一次空态，
 * "详情页说没有、查询页说有"这种矛盾就是这么来的。</p>
 */
const props = defineProps({
  trace: { type: Object, required: true },
  productName: { type: String, default: '' },
  emptyTitle: { type: String, default: '该商品尚未绑定生产批次' },
})

const nodes = computed(() => props.trace.nodes ?? [])
const codes = computed(() => props.trace.codes ?? [])
const displayName = computed(() => props.productName || props.trace.productName || props.trace.cropName || '')

const codeLabels = { active: '已激活', scanned: '已扫码', generated: '未激活', inactive: '未激活', expired: '已过期', revoked: '已作废' }
function codeLabel(status, expired = false) {
  const key = String(status ?? '').trim().toLowerCase()
  if (key === 'revoked') return '已作废'
  if (expired === true) return '已过期'
  return codeLabels[key] || '状态未知'
}
const invalidCodeLabel = computed(() => {
  const t = props.trace
  if (!t.traceCode || t.unavailable) return ''
  const label = codeLabel(t.codeStatus, t.expired)
  if (label === '已作废' || label === '已过期') return `${label}，不可核验`
  if (t.verifiable === false) return label === '未激活' ? '未激活，不可核验' : '当前不可核验'
  return ''
})

const statusOf = (node) => String(node.chainStatus ?? '').toUpperCase()
const has = (stage) => (props.trace.stages ?? []).includes(stage)

const fmtTime = (value) => String(value ?? '').replace('T', ' ').slice(0, 16)

/**
 * 生产溯源深链。
 *
 * <p>地址拼装收在 cross-module 的 productionChainUrl 一处（history 路由，不能带 #，
 * 也不能挂 /prod 前缀），这里只决定"带码还是带批次"：消费者手上有码就传码，
 * 按商品看链路时没有码，退一步传批次号。</p>
 */
const chainDeepLink = computed(() => productionChainUrl({
  code: codes.value[0]?.code || props.trace.traceCode || '',
  batchId: props.trace.batchNo || '',
}))
</script>

<style scoped>
.trace-wrap {
  display: grid;
  gap: 12px;
}

.code-warning {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 14px;
  padding: 12px 16px;
  border-left: 4px solid #ac3c2e;
  background: #fff2ed;
  color: #822a20;
  overflow-wrap: anywhere;
}

.history-title {
  margin: 0;
  font-size: 16px;
}

.trace-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e3eae5;
}

.trace-head > div:first-child {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.t-batch {
  color: #1d3b2c;
  font-size: 15px;
}

.trace-ops {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.trace-timeline {
  display: grid;
  gap: 0;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}

.trace-node {
  position: relative;
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 12px;
  padding: 0 0 16px;
}

.trace-node::before {
  content: "";
  position: absolute;
  top: 22px;
  bottom: -2px;
  left: 12px;
  width: 1px;
  background: #e3eae5;
}

.trace-node:last-child::before {
  display: none;
}

.node-dot {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #eef4ef;
  color: #35543f;
  font-size: var(--agri-font-size-aux, 13px);
  font-weight: 600;
}

.trace-node.onchain .node-dot {
  background: #2d8f4e;
  color: #fff;
}

.node-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.node-hd b {
  color: #23402f;
  font-size: var(--agri-font-size-base, 14px);
}

.node-time {
  color: #6b7c72;
  font-size: var(--agri-font-size-aux, 13px);
}

.node-chain {
  padding: 1px 7px;
  border-radius: 6px;
  background: #eef2ef;
  color: #718277;
  font-size: var(--agri-font-size-micro, 12px);
}

.node-chain.ok {
  background: #e5f5eb;
  color: #0e5233;
}

.node-chain.pending {
  background: #fff3dd;
  color: #a96a08;
}

.node-chain.failed {
  background: #fbe9e9;
  color: #913838;
}

.node-detail {
  margin: 4px 0 0;
  color: #4b5d53;
  font-size: var(--agri-font-size-aux, 13px);
  line-height: 1.65;
}

.node-hash {
  margin: 3px 0 0;
  color: #718277;
  font-family: ui-monospace, monospace;
  font-size: var(--agri-font-size-micro, 12px);
  word-break: break-all;
}

.node-fail {
  margin: 3px 0 0;
  color: #c54b4b;
  font-size: var(--agri-font-size-micro, 12px);
}

.trace-codes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.code-chip {
  padding: 2px 8px;
  border: 1px solid #dfe8e2;
  border-radius: 6px;
  background: #fbfdfc;
  font-size: var(--agri-font-size-aux, 13px);
}

.code-chip em {
  margin-left: 6px;
  color: #718277;
  font-style: normal;
}

.pane-note {
  margin: 2px 0 0;
  color: #6b7c72;
  font-size: var(--agri-font-size-aux, 13px);
  line-height: 1.7;
}
</style>
