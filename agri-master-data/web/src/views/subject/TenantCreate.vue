<template>
  <div class="mds-page">
    <PageHeader
      title="开通配置"
      subtitle="主体认证通过后的开通动作：套餐选择、配额基线、模块权限与统计核对。主体本身由统一认证注册产生。"
      source="主体主档 · 套餐 / 配额"
    >
      <template #actions>
        <button class="mds-btn" @click="router.push('/subject/list')">返回主体列表</button>
      </template>
    </PageHeader>

    <NoticeBar tone="warning" title="本页不新建租户（后端已明确拒绝）：">
      租户与企业 / 个人经营主体一一对应，新建入口请走统一认证中心注册主体。
      主数据后端 <code>createTenant</code> 目前直接返回业务错误，因此这里不提供会必然失败的表单；
      主体产生后，回到本页完成套餐与配额配置。
    </NoticeBar>

    <div class="mds-card">
      <div class="mds-card-head">
        <div>
          <h2 class="mds-card-title">开通过程</h2>
          <p class="mds-card-sub">企业主体从注册到可用的五个环节，灰字标注主责方</p>
        </div>
      </div>
      <div class="mds-card-body">
        <div class="mds-steps">
          <div class="mds-step is-done"><span class="mds-step__no">1</span>统一认证注册</div>
          <span class="mds-step__line" />
          <div class="mds-step is-done"><span class="mds-step__no">2</span>实名 / 资质审核</div>
          <span class="mds-step__line" />
          <div class="mds-step is-current"><span class="mds-step__no">3</span>套餐与配额</div>
          <span class="mds-step__line" />
          <div class="mds-step"><span class="mds-step__no">4</span>模块开通</div>
          <span class="mds-step__line" />
          <div class="mds-step"><span class="mds-step__no">5</span>启用运行</div>
        </div>
        <table class="mds-table" style="margin-top: 14px">
          <thead>
            <tr>
              <th>环节</th>
              <th>主责方</th>
              <th>本模块的操作入口</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>主体注册</td>
              <td>统一认证中心</td>
              <td class="mds-muted">—（注册完成后自动出现在主体列表）</td>
            </tr>
            <tr>
              <td>实名 / 资质审核</td>
              <td>用户中心运营端</td>
              <td><button class="mds-btn mds-btn--link" @click="openUserCenter">前往用户中心 · 认证审核</button></td>
            </tr>
            <tr>
              <td>套餐与配额</td>
              <td>主数据管理（本模块）</td>
              <td>
                <button class="mds-btn mds-btn--link" @click="router.push('/subject/package')">套餐模板</button>
                <button class="mds-btn mds-btn--link" @click="router.push('/subject/quota')">配额与超限</button>
              </td>
            </tr>
            <tr>
              <td>模块开通</td>
              <td>主数据管理（本模块）</td>
              <td class="mds-muted">模块开通标记尚未在主数据后端建模，需要时在实例部署侧配置</td>
            </tr>
            <tr>
              <td>启用运行</td>
              <td>主数据管理（本模块）</td>
              <td><button class="mds-btn mds-btn--link" @click="router.push('/subject/audit')">入驻与生命周期</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mds-grid mds-grid--3">
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">套餐基线</h2>
        </div>
        <div class="mds-card-body">
          <p class="mds-hint">
            套餐决定用户数、组织数、商品数、存储与 API 调用的默认上限；配额可在基线之上单独加购。
          </p>
          <button class="mds-btn mds-btn--primary" style="margin-top: 12px" @click="router.push('/subject/package')">
            管理套餐模板
          </button>
        </div>
      </div>
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">配额与超限</h2>
        </div>
        <div class="mds-card-body">
          <p class="mds-hint">
            逐个主体调整配额上限、预警阈值与超限策略；超限策略决定新增动作是硬拦截、限流还是排队。
          </p>
          <button class="mds-btn mds-btn--primary" style="margin-top: 12px" @click="router.push('/subject/quota')">
            配置主体配额
          </button>
        </div>
      </div>
      <div class="mds-card" style="margin-bottom: 0">
        <div class="mds-card-head">
          <h2 class="mds-card-title">开通后核对</h2>
        </div>
        <div class="mds-card-body">
          <p class="mds-hint">
            开通完成后，在主体数据统计里核对主体数、认证率与配额使用趋势，确认没有漏配的主体。
          </p>
          <button class="mds-btn" style="margin-top: 12px" @click="router.push('/subject/statistics')">
            查看主体统计
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'

const router = useRouter()

function openUserCenter() {
  window.open(`${window.location.protocol}//${window.location.hostname}:8115/user-center-ops/`, '_blank', 'noopener')
}
</script>
