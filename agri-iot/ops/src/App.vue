<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <UnifiedSsoGate client-id="iot-admin" landing-path="/dashboard" :required-permissions="OPS_PERMISSIONS">
      <div class="o-shell" :class="{ collapsed }">
        <aside class="o-sidebar">
          <button type="button" class="o-brand" @click="go('dashboard')">
            <img class="o-brand-logo" :src="`${baseUrl}fengchain.svg`" alt="丰链云" />
            <div v-if="!collapsed">
              <b>丰链云</b>
              <small>FENGCHAIN · AGRI</small>
            </div>
          </button>

          <WorkspaceNavigation
            client-id="iot-admin"
            :groups="MENU"
            :selected="page"
            :collapsed="collapsed"
            :mobile-open="mobileOpen"
            @navigate="(key) => go(key as Page)"
            @mobile-close="mobileOpen = false"
          />

          <div class="pc-side-user">
            <SidebarUserCard
              client-id="iot-admin"
              role-label="物联网平台运营"
              :collapsed="collapsed"
              :switch-url="userPortalUrl"
              switch-label="切换身份（用户端）"
            />
          </div>
        </aside>

        <div class="o-main">
          <AgriVueTopHeader
            header-class="o-header"
            right-class="o-header-right"
            :collapsed="collapsed"
            :mobile="isMobile"
            :mobile-open="mobileOpen"
            :breadcrumbs="['物联网运营', TITLES[page]]"
            @toggle-collapse="toggleSidebar"
          >
            <template #center>
              <form @submit.prevent="go('devices')">
                <SearchOutlined />
                <input placeholder="搜索设备 / 租户 / 告警" />
              </form>
            </template>
            <template #right>
              <span>{{ clock.date() }}</span>
              <button type="button" title="设备接入待审核" @click="go('access')">
                <BellOutlined />
                <i v-if="pendingAuditsCount > 0">{{ pendingAuditsCount }}</i>
              </button>
              <AccountMenu client-id="iot-admin" show-logs @logs="go('logs')" />
            </template>
          </AgriVueTopHeader>

          <AgriVueWorkspaceTabs
            :active-key="page"
            :active-label="TITLES[page]"
            home-key="dashboard"
            :home-label="TITLES.dashboard"
            storage-key="agri-iot-ops:workspace-tabs"
            @navigate="(key) => go(key as Page)"
          />

          <main>
            <!-- 运营概览大屏 -->
            <div v-if="page === 'dashboard'" class="o-page">
              <div v-if="!overview" class="o-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="o-title">
                  <div>
                    <span>IOT PLATFORM · OPERATIONS</span>
                    <h1>运营概览大屏</h1>
                    <p>全平台设备接入、在线状态、告警与数据吞吐的实时运营视角。</p>
                  </div>
                  <div class="o-actions">
                    <a-button @click="loadOverview">刷新数据</a-button>
                    <a-button type="primary" @click="go('alerts')">进入告警运营</a-button>
                  </div>
                </div>
                <div class="o-metrics">
                  <div class="o-metric cloud"><span><CloudServerOutlined /></span><div><small>接入设备</small><b>{{ overview.metrics.devices }}</b><em>覆盖 {{ overview.metrics.tenants }} 个租户</em></div></div>
                  <div class="o-metric online"><span><ApiOutlined /></span><div><small>实时在线</small><b>{{ overview.metrics.online }}</b><em>在线率 {{ overview.metrics.devices ? ((overview.metrics.online / overview.metrics.devices) * 100).toFixed(1) : '0.0' }}%</em></div></div>
                  <div class="o-metric alert"><span><AlertOutlined /></span><div><small>待处理告警</small><b>{{ overview.metrics.openAlerts }}</b><em>网关 {{ overview.metrics.gateways }} 台</em></div></div>
                  <div class="o-metric data"><span><DatabaseOutlined /></span><div><small>数据吞吐</small><b>52万条/分</b><em>今日控制 8,562 次</em></div></div>
                </div>
                <div class="o-dashboard-grid">
                  <section class="o-card">
                    <div class="o-card-head"><div><b>设备在线率趋势</b><small>近 24 小时 · 秒级采样</small></div></div>
                    <div class="o-line-chart">
                      <div v-for="(v, i) in overview.onlineTrend" :key="i">
                        <i :style="{ height: `${(v - 92) * 25 + 15}%` }" />
                        <span>{{ 9 + i * 2 }}:00</span>
                        <b>{{ v }}%</b>
                      </div>
                    </div>
                  </section>
                  <section class="o-card">
                    <div class="o-card-head"><div><b>设备类型分布</b><small>全平台</small></div></div>
                    <div class="o-horizontal">
                      <div v-for="t in overview.typeDistribution" :key="t.name">
                        <span>{{ t.name }}</span>
                        <div><i :style="{ width: `${(t.value / maxTypeVal) * 100}%` }" /></div>
                        <b>{{ t.value }}</b>
                      </div>
                    </div>
                  </section>
                </div>
                <div class="o-dashboard-grid">
                  <section class="o-card">
                    <div class="o-card-head"><div><b>实时告警流</b><small>自动派单与状态跟踪</small></div></div>
                    <div v-for="a in overview.alerts" :key="a.id" class="o-alert-row">
                      <span :class="`level-${a.level}`"><AlertOutlined /></span>
                      <div><b>{{ a.title }}</b><p>{{ a.tenantName }} · {{ a.deviceName }} · {{ a.createdAt }}</p></div>
                      <a-tag :class="`o-status tone-${statusMeta(a.status).tone}`">{{ statusMeta(a.status).label }}</a-tag>
                    </div>
                  </section>
                  <section class="o-card">
                    <div class="o-card-head"><div><b>租户设备排名</b><small>按接入规模</small></div></div>
                    <div v-for="(t, i) in overview.tenants" :key="t.id" class="o-rank">
                      <span>{{ i + 1 }}</span>
                      <div><b>{{ t.tenantName }}</b><small>{{ t.region }} · {{ t.planName }}</small></div>
                      <em>{{ t.deviceCount }}</em>
                    </div>
                  </section>
                </div>
                <section class="o-ai-brief">
                  <span>✦</span>
                  <div>
                    <small>AI 运维建议</small>
                    <p>平台在线率 94.3%，离线设备集中在金穗粮食合作社；建议优先检查 NB-IoT 信号与网关供电。另有 4 台新设备等待接入审核。</p>
                  </div>
                </section>
              </template>
            </div>

            <!-- 租户与配额 -->
            <div v-else-if="page === 'tenants'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>租户与配额</h1><p>物联网租户、设备容量、套餐到期和服务状态。</p></div></div>
              <AgriAntdvListTable
                :columns="tenantColumns"
                :data="filteredTenants"
                row-key="id"
                client-pagination
                column-settings-storage-key="iot-ops:tenants"
                @refresh="loadTenants"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="applyTenantFilter" @reset="resetTenantFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="tenantDraft"
                        allow-clear
                        placeholder="租户名称 / 编码 / 区域 / 套餐"
                        @press-enter="applyTenantFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>状态</label>
                      <a-select
                        v-model:value="tenantStatusFilter"
                        :options="tenantStatusOptions"
                        @change="applyTenantFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-tenantName="{ record }">
                  <div class="o-entity"><b>{{ record.tenantName }}</b><small>{{ record.tenantCode }} · {{ record.region }}</small></div>
                </template>
                <template #cell-usage="{ record }">
                  <div class="usage">
                    <a-progress :percent="Math.min(100, Math.round((Number(record.deviceCount) / Math.max(Number(record.deviceLimit), 1)) * 100))" size="small" stroke-color="#159a5e" :format="() => `${record.deviceCount}/${record.deviceLimit}`" />
                  </div>
                </template>
                <template #cell-status="{ record }">
                  <a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag>
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="tenantRowActions(record as unknown as Tenant)" />
                </template>
              </AgriAntdvListTable>
              <a-modal :open="Boolean(quotaTarget)" title="调整租户配额" ok-text="保存" @cancel="quotaTarget = null" @ok="saveQuota">
                <div class="o-summary"><b>{{ quotaTarget?.tenantName }}</b><span>当前设备数 {{ quotaTarget?.deviceCount }}</span></div>
                <a-form layout="vertical">
                  <a-form-item label="设备上限">
                    <a-input-number v-model:value="quotaLimit" :min="quotaTarget?.deviceCount || 1" style="width: 100%" />
                  </a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 平台设备监控 -->
            <div v-else-if="page === 'devices'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>平台设备监控</h1><p>全平台设备在线状态、关键指标、租户归属与固件版本。</p></div></div>
              <AgriAntdvListTable
                :columns="deviceColumns"
                :data="devices"
                row-key="id"
                client-pagination
                column-settings-storage-key="iot-ops:devices"
                @refresh="loadDevices"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="loadDevices" @reset="resetDevices">
                    <div class="agri-vue-filter-field">
                      <label>在线状态</label>
                      <a-select
                        v-model:value="deviceStatus"
                        :options="deviceStatusOptions"
                        @change="loadDevices"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="deviceKeyword"
                        allow-clear
                        placeholder="设备名称 / 编码"
                        @press-enter="loadDevices"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-deviceName="{ record }">
                  <div class="o-entity"><b>{{ record.deviceName }}</b><small>{{ record.deviceCode }} · {{ record.typeName }}</small></div>
                </template>
                <template #cell-tenant="{ record }">
                  <div class="o-entity"><b>{{ record.tenantName }}</b><small>{{ record.farmName }}</small></div>
                </template>
                <template #cell-onlineStatus="{ record }">
                  <a-tag :class="`o-status tone-${statusMeta(String(record.onlineStatus ?? '')).tone}`">{{ statusMeta(String(record.onlineStatus ?? '')).label }}</a-tag>
                </template>
                <template #cell-rssi="{ record }">{{ record.rssi ? `${record.rssi} dBm` : '—' }}</template>
                <template #cell-battery="{ record }">{{ record.battery }}%</template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="deviceRowActions(record as unknown as Device)" />
                </template>
              </AgriAntdvListTable>
              <a-modal :open="Boolean(samplingDevice)" :title="`${samplingDevice?.deviceName ?? ''} · 采样配置`" :footer="null" @cancel="samplingDevice = null">
                <DeviceSampling v-if="samplingDevice" :key="samplingDevice.id" :device-id="samplingDevice.id" :load="opsApi.sampling" :save="opsApi.saveSampling" />
              </a-modal>
              <a-modal :open="Boolean(commandDevice)" title="设备指令与回执" :footer="null" :width="1200" @cancel="commandDevice = null">
                <CommandReceipts v-if="commandDevice" :key="commandDevice.id" :device-id="commandDevice.id" :load="opsApi.commandReceipts" />
              </a-modal>
            </div>

            <!-- 网关运维 -->
            <div v-else-if="page === 'gateways'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>网关运维</h1><p>网关在线率、挂载设备、资源占用与远程维护。</p></div></div>
              <div class="o-gateway-grid">
                <section v-for="g in gateways" :key="g.id" class="o-card">
                  <div class="o-card-head">
                    <div><b>{{ g.gatewayName }}</b><small>{{ g.gatewayCode }} · {{ g.farmName }}</small></div>
                    <a-tag :class="`o-status tone-${statusMeta(g.onlineStatus).tone}`">{{ statusMeta(g.onlineStatus).label }}</a-tag>
                  </div>
                  <div class="o-summary">
                    <span>挂载设备 {{ g.onlineCount }}/{{ g.totalCount }}</span>
                    <span>{{ g.protocol }} · {{ g.firmwareVersion }}</span>
                    <span>最近在线 {{ g.lastOnline }}</span>
                  </div>
                  <span class="o-label">CPU {{ g.cpuRate }}%</span>
                  <a-progress :percent="Number(g.cpuRate)" :show-info="false" stroke-color="#159a5e" />
                  <span class="o-label">内存 {{ g.memoryRate }}%</span>
                  <a-progress :percent="Number(g.memoryRate)" :show-info="false" stroke-color="#176c93" />
                  <footer>
                    <span>{{ g.model }}</span>
                    <a-button size="small" @click="receiptGateway = g">重启/升级回执</a-button>
                    <a-button size="small" @click="confirmRestartGateway(g)">远程重启</a-button>
                  </footer>
                </section>
              </div>
              <a-modal :open="Boolean(receiptGateway)" title="网关重启与OTA升级回执" :footer="null" :width="1200" @cancel="receiptGateway = null">
                <template v-if="receiptGateway">
                  <h3>重启回执</h3>
                  <CommandReceipts :key="`restart-${receiptGateway.id}`" :device-id="receiptGateway.id" :load="opsApi.gatewayCommandReceipts" />
                  <h3>OTA升级回执（动作列为目标版本）</h3>
                  <CommandReceipts :key="`ota-${receiptGateway.id}`" :device-id="receiptGateway.id" :load="opsApi.otaReceipts" />
                </template>
              </a-modal>
            </div>

            <!-- 告警运营中心 -->
            <div v-else-if="page === 'alerts'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>告警运营中心</h1><p>全平台设备告警统一台账；待处理→处理中→已处理，双端共用处置记录。</p></div></div>
              <AgriAntdvListTable
                :columns="alertColumns"
                :data="filteredAlerts"
                row-key="id"
                client-pagination
                empty-text="暂无告警记录，设备产生告警后会自动进入统一台账"
                column-settings-storage-key="iot-ops:alerts"
                @refresh="loadAlerts"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="3" @search="applyAlertFilter" @reset="resetAlertFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="alertDraft"
                        allow-clear
                        placeholder="告警标题 / 编号 / 设备 / 租户"
                        @press-enter="applyAlertFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>告警级别</label>
                      <a-select
                        v-model:value="alertLevelFilter"
                        :options="alertLevelOptions"
                        @change="applyAlertFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>处置状态</label>
                      <a-select
                        v-model:value="alertStatusFilter"
                        :options="alertStatusOptions"
                        @change="applyAlertFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-title="{ record }">
                  <div class="o-entity"><b>{{ record.title }}</b><small>{{ record.alertNo }} · {{ record.tenantName }}</small></div>
                </template>
                <template #cell-level="{ record }">
                  <a-tag :class="`o-status tone-${statusMeta(String(record.level ?? '')).tone}`">{{ statusMeta(String(record.level ?? '')).label }}</a-tag>
                </template>
                <template #cell-status="{ record }">
                  <a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag>
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="alertRowActions(record as unknown as Alert)" />
                </template>
              </AgriAntdvListTable>
              <a-modal :open="Boolean(alertTarget)" title="告警处置" ok-text="确认处置" @cancel="alertTarget = null" @ok="submitHandleAlert">
                <div class="o-summary"><b>{{ alertTarget?.title }}</b><span>{{ alertTarget?.content }}</span></div>
                <a-textarea v-model:value="alertNote" :rows="4" placeholder="填写处置动作与结论（会写入审计日志）" />
              </a-modal>
            </div>

            <!-- 阈值规则治理 -->
            <div v-else-if="page === 'rules'" class="o-page">
              <div class="o-title">
                <div><span>IOT PLATFORM · OPERATIONS</span><h1>阈值规则治理</h1><p>按指标维护平台兜底规则；经营主体可在用户端按同一指标覆盖阈值。</p></div>
              </div>
              <AgriAntdvListTable
                :columns="platformRuleColumns"
                :data="platformRules"
                row-key="id"
                client-pagination
                column-settings-storage-key="iot-ops:platform-rules"
                @refresh="loadRules"
              >
                <template #toolbar-left>
                  <div class="o-table-caption-wrap">
                    <a-button type="primary" @click="openRuleForm(null)">+ 新增指标规则</a-button>
                    <div class="o-table-caption"><b>平台指标阈值</b><small>每条规则对应一个指标、比较方式、阈值和持续时长</small></div>
                  </div>
                </template>
                <template #cell-metric="{ record }">{{ record.metricName }}{{ record.deviceType ? ` · ${record.deviceType}` : '' }}</template>
                <template #cell-cond="{ record }">{{ record.operator }} {{ Number(record.threshold) }}</template>
                <template #cell-duration="{ record }">{{ Number(record.durationSeconds) > 0 ? `${record.durationSeconds} 秒` : '瞬时' }}</template>
                <template #cell-level="{ record }"><a-tag :class="`o-status tone-${statusMeta(String(record.level ?? '')).tone}`">{{ statusMeta(String(record.level ?? '')).label }}</a-tag></template>
                <template #cell-enabled="{ record }"><a-tag :class="`o-status tone-${statusMeta(record.enabled ? 'running' : 'disabled').tone}`">{{ record.enabled ? '运行中' : '已停用' }}</a-tag></template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="platformRuleRowActions(record as unknown as AlertRule)" />
                </template>
              </AgriAntdvListTable>
              <AgriAntdvListTable
                :columns="tenantRuleColumns"
                :data="tenantRules"
                :row-key="(row) => `${row.tenantId}-${row.id}`"
                client-pagination
                column-settings-storage-key="iot-ops:tenant-rules"
                @refresh="loadRules"
              >
                <template #toolbar-left>
                  <div class="o-table-caption"><b>各经营主体自定义阈值</b><small>只读：主体在用户端维护，同指标规则覆盖平台预置</small></div>
                </template>
                <template #cell-tenantName="{ record }">{{ record.tenantName || '未归属' }}</template>
                <template #cell-metric="{ record }">{{ record.metricName }}{{ record.deviceType ? ` · ${record.deviceType}` : '' }}</template>
                <template #cell-cond="{ record }">{{ record.operator }} {{ Number(record.threshold) }}</template>
                <template #cell-duration="{ record }">{{ Number(record.durationSeconds) > 0 ? `${record.durationSeconds} 秒` : '瞬时' }}</template>
                <template #cell-level="{ record }"><a-tag :class="`o-status tone-${statusMeta(String(record.level ?? '')).tone}`">{{ statusMeta(String(record.level ?? '')).label }}</a-tag></template>
                <template #cell-enabled="{ record }"><a-tag :class="`o-status tone-${statusMeta(record.enabled ? 'running' : 'disabled').tone}`">{{ record.enabled ? '运行中' : '已停用' }}</a-tag></template>
              </AgriAntdvListTable>
              <a-modal v-model:open="ruleModalOpen" :title="editingRule ? '编辑平台指标规则' : '新增平台指标规则'" ok-text="保存" @ok="saveRule">
                <a-form layout="vertical">
                  <a-form-item label="规则名称" required><a-input v-model:value="ruleForm.ruleName" :maxlength="160" placeholder="例如：温度过高告警" /></a-form-item>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
                    <a-form-item label="监控指标" required><a-select v-model:value="ruleForm.metricKey" show-search option-filter-prop="label" :options="ruleMetricOptions" /></a-form-item>
                    <a-form-item label="限定设备类型"><a-select v-model:value="ruleForm.deviceType" allow-clear placeholder="不限设备类型" :options="ruleDeviceTypeOptions" /></a-form-item>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
                    <a-form-item label="比较方式" required><a-select v-model:value="ruleForm.operator" :options="ruleOperatorOptions" /></a-form-item>
                    <a-form-item label="阈值" required><a-input-number v-model:value="ruleForm.threshold" style="width: 100%" /></a-form-item>
                  </div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">
                    <a-form-item label="持续时间（秒）"><a-input-number v-model:value="ruleForm.durationSeconds" :min="0" :max="86400" :step="1" style="width: 100%" /></a-form-item>
                    <a-form-item label="告警等级" required><a-select v-model:value="ruleForm.level" :options="ruleLevelOptions" /></a-form-item>
                  </div>
                  <div class="o-summary"><b>生效口径</b><span>自动告警按该指标的独立采样周期判定连续性；采样断档、无效读数不会满足持续条件。</span></div>
                </a-form>
              </a-modal>
            </div>

            <!-- 产品与协议管理 -->
            <div v-else-if="page === 'products'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>产品与协议管理</h1><p>物联网产品、物模型、接入协议和连接状态。</p></div></div>
              <div class="o-dashboard-grid">
                <AgriAntdvListTable
                  :columns="productColumns"
                  :data="products"
                  row-key="id"
                  client-pagination
                  column-settings-storage-key="iot-ops:products"
                  @refresh="loadProducts"
                >
                  <template #toolbar-left>
                    <div class="o-table-caption"><b>产品与物模型</b><small>认证产品清单</small></div>
                  </template>
                  <template #cell-productName="{ record }">
                    <div class="o-entity"><b>{{ record.productName }}</b><small>{{ record.productKey }} · {{ record.model }}</small></div>
                  </template>
                  <template #cell-status="{ record }"><a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag></template>
                </AgriAntdvListTable>
                <section class="o-card">
                  <div class="o-card-head"><div><b>协议适配器</b><small>连接与端点</small></div></div>
                  <div v-for="p in protocols" :key="p.id" class="o-protocol">
                    <span><ApiOutlined /></span>
                    <div><b>{{ p.protocolName }}</b><small>{{ p.endpoint }}:{{ p.port }}</small></div>
                    <em>{{ p.connections }} 连接</em>
                    <a-tag :class="`o-status tone-${statusMeta(p.status).tone}`">{{ statusMeta(p.status).label }}</a-tag>
                  </div>
                </section>
              </div>
            </div>

            <!-- 设备接入审核 -->
            <div v-else-if="page === 'access'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>设备接入审核</h1><p>自动注册与人工接入审核、物模型校验和风险拦截。</p></div></div>
              <AgriAntdvListTable
                :columns="accessColumns"
                :data="filteredAccessAudits"
                row-key="id"
                client-pagination
                empty-text="暂无接入申请，设备提交接入后会出现在这里"
                column-settings-storage-key="iot-ops:access-audits"
                @refresh="loadAccessAudits"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="applyAccessFilter" @reset="resetAccessFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="accessDraft"
                        allow-clear
                        placeholder="设备名称 / 编码 / 所属主体"
                        @press-enter="applyAccessFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>审核状态</label>
                      <a-select
                        v-model:value="accessStatusFilter"
                        :options="accessStatusOptions"
                        @change="applyAccessFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-deviceName="{ record }">
                  <div class="o-entity"><b>{{ record.deviceName }}</b><small>{{ record.deviceCode }} · {{ record.requestType }}</small></div>
                </template>
                <template #cell-auditor="{ record }">{{ record.auditor || '待分配' }}</template>
                <template #cell-status="{ record }"><a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag></template>
                <template #cell-note="{ record }">{{ record.note || '等待物模型与产品认证校验' }}</template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions v-if="record.status === 'pending'" :actions="accessRowActions(record as unknown as AccessAudit)" />
                  <span v-else class="muted">—</span>
                </template>
              </AgriAntdvListTable>
              <a-modal :open="Boolean(accessTarget)" :title="accessTarget?.status === 'approved' ? '通过接入' : '驳回接入'" :confirm-loading="accessSaving" ok-text="提交审核" @cancel="accessTarget = null" @ok="submitAccessReview">
                <div class="o-summary"><b>{{ accessTarget?.row.deviceName }}</b><span>{{ accessTarget?.row.tenantName }} · {{ accessTarget?.row.requestType }}</span></div>
                <a-textarea v-model:value="accessNote" :rows="3" placeholder="填写物模型/认证白名单的核验结论（会写入审计）" />
              </a-modal>
            </div>

            <!-- 固件包管理 -->
            <div v-else-if="page === 'firmwares'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>固件包版本台账</h1><p>设备与边缘网关的固件包、适用型号、完整SHA-256防篡改摘要及发布状态。</p></div></div>
              <AgriAntdvListTable
                :columns="fwColumns"
                :data="firmwares"
                row-key="id"
                :loading="fwLoading"
                client-pagination
                column-settings-storage-key="iot-ops:firmwares"
                @refresh="loadFirmwares"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="3" :loading="fwLoading" @search="loadFirmwares" @reset="resetFirmwares">
                    <div class="agri-vue-filter-field">
                      <label>固件类型</label>
                      <a-select
                        v-model:value="fwType"
                        placeholder="全部类型"
                        allow-clear
                        :options="fwTypeOptions"
                        @change="loadFirmwares"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>状态</label>
                      <a-select
                        v-model:value="fwStatus"
                        placeholder="全部状态"
                        allow-clear
                        :options="fwStatusOptions"
                        @change="loadFirmwares"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>适用型号</label>
                      <a-input
                        v-model:value="fwModel"
                        allow-clear
                        placeholder="适用型号搜索"
                        @press-enter="loadFirmwares"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #toolbar-left>
                  <a-button type="primary" @click="openRegisterFirmware">+ 登记新固件包</a-button>
                </template>
                <template #cell-name="{ record }">
                  <div>
                    <b>{{ record.firmwareName }}</b>
                    <div style="font-size: 12px; color: #666">{{ record.versionName }} · {{ record.firmwareType }} · 型号: {{ record.targetModel }}</div>
                  </div>
                </template>
                <template #cell-fileSizeBytes="{ record }">{{ record.fileSizeBytes ? `${(Number(record.fileSizeBytes) / 1024 / 1024).toFixed(2)} MB` : '-' }}</template>
                <template #cell-sha256Text="{ record }"><span style="font-family: monospace; font-size: 12px">{{ record.sha256Text }}</span></template>
                <template #cell-status="{ record }">
                  <a-tag :color="record.status === 'stable' ? 'success' : record.status === 'draft' ? 'warning' : 'default'">
                    {{ record.status === 'stable' ? '已发布稳定版' : record.status === 'draft' ? '草稿' : '已废弃' }}
                  </a-tag>
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="fwRowActions(record as unknown as FirmwarePackage)" />
                </template>
              </AgriAntdvListTable>
              <a-modal :open="Boolean(fwDetailTarget)" title="固件包详情" :width="700" :footer="null" @cancel="fwDetailTarget = null">
                <div v-if="fwDetailTarget" style="word-break: break-all">
                  <p>{{ fwDetailTarget.firmwareName }} · {{ fwDetailTarget.versionName }}</p>
                  <p>适用型号：{{ fwDetailTarget.targetModel }}</p>
                  <p>包地址：{{ fwDetailTarget.packageUrl || '历史未登记' }}</p>
                  <p>SHA-256：{{ fwDetailTarget.sha256Text }}</p>
                  <p>发布：{{ fwDetailTarget.publishedAt || '—' }}；废弃：{{ fwDetailTarget.deprecatedAt || '—' }}</p>
                  <p>发布说明：{{ fwDetailTarget.releaseNotes || '—' }}</p>
                  <p>变更说明：{{ fwDetailTarget.changelogText || '—' }}</p>
                </div>
              </a-modal>
              <a-modal :open="deprecatingFwId !== null" title="废弃固件包" :ok-button-props="{ disabled: deprecateReason.trim().length < 4 }" @cancel="deprecatingFwId = null" @ok="submitDeprecateFirmware">
                <a-textarea v-model:value="deprecateReason" :maxlength="300" placeholder="填写实际下线原因，至少4个字" />
              </a-modal>
              <a-modal
                v-model:open="fwModalOpen"
                title="登记新固件包"
                :confirm-loading="fwSaving || fwUploading"
                :ok-button-props="{ disabled: fwUploading }"
                ok-text="保存草稿包"
                @ok="submitRegisterFirmware"
              >
                <a-form layout="vertical">
                  <a-form-item label="固件包名称" required><a-input v-model:value="fwForm.firmwareName" placeholder="如：EdgeGateway 稳定升级包" /></a-form-item>
                  <a-form-item label="版本号（规范语义版本）" required><a-input v-model:value="fwForm.versionName" placeholder="v1.2.0" /></a-form-item>
                  <div style="display: flex; gap: 12px">
                    <a-form-item label="类型" style="flex: 1" required><a-select v-model:value="fwForm.firmwareType" :options="fwTypeOptions" /></a-form-item>
                    <a-form-item label="适用型号" style="flex: 1" required><a-input v-model:value="fwForm.targetModel" placeholder="ALL 或 GW-PRO-2026" /></a-form-item>
                  </div>
                  <div style="margin-bottom: 16px">
                    <p>上传固件文件后由服务端计算摘要与大小；不解压、不执行。仅支持bin/img/zip/fw/hex/tar/gz，最大256MB。上传校验不代替厂家签名和型号兼容认证。</p>
                    <a-input v-model:value="fwExpectedHash" :disabled="fwUploading || fwUploaded" :maxlength="64" placeholder="可选：厂家提供的预期SHA-256，填写后必须匹配" />
                    <input type="file" accept=".bin,.img,.zip,.fw,.hex,.tar,.gz" :disabled="fwUploading || fwSaving" style="margin-top: 8px" @change="handleFirmwareFileChange" />
                    <p v-if="fwUploading">正在上传并校验，请勿关闭…</p>
                    <p v-else-if="fwUploaded">已按实际文件核验；地址、摘要、大小已锁定。重新上传可替换，外部地址请重新打开登记窗口。</p>
                    <p v-else>也可登记外部HTTPS地址，但本服务未核验其实际文件。</p>
                  </div>
                  <a-form-item label="HTTPS 固件包下载链接" required><a-input v-model:value="fwForm.packageUrl" :disabled="fwUploaded || fwUploading" placeholder="已部署的 HTTPS 固件文件地址" /></a-form-item>
                  <a-form-item label="包大小（字节）" required><a-input-number v-model:value="fwForm.fileSizeBytes" :disabled="fwUploaded || fwUploading" style="width: 100%" :min="1" :max="2147483648" placeholder="如 15728640" /></a-form-item>
                  <a-form-item label="64位 SHA-256 防篡改摘要" required><a-input v-model:value="fwForm.sha256Text" :disabled="fwUploaded || fwUploading" placeholder="完整的64位sha256十六进制字符串" /></a-form-item>
                  <a-form-item label="发布说明"><a-textarea v-model:value="fwForm.releaseNotes" :rows="2" placeholder="固件版本核心特性或更新概要" /></a-form-item>
                  <a-form-item label="Changelog 详细变更"><a-textarea v-model:value="fwForm.changelogText" :rows="2" placeholder="修复问题清单及硬件兼容清单" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- OTA 升级运营 -->
            <div v-else-if="page === 'ota'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>OTA 升级运营</h1><p>固件版本、灰度范围、执行窗口与升级结果。</p></div></div>
              <p>成功数仅来自版本及摘要一致的网关回执；超时为结果未知。逐网关明细请在网关运维的回执入口查询。</p>
              <div class="o-ota-list">
                <section v-for="t in otaTasks" :key="t.id" class="o-card">
                  <div class="o-card-head">
                    <div><b>{{ t.taskNo }}</b><small>{{ t.firmwareVersion }} · {{ t.targetScope }}</small></div>
                    <a-tag :class="`o-status tone-${statusMeta(t.status).tone}`">{{ statusMeta(t.status).label }}</a-tag>
                  </div>
                  <div class="o-summary"><span>目标 {{ t.targetCount }} 台</span><span>窗口 {{ t.executeWindow }}</span><span>创建 {{ t.createdAt }}</span></div>
                  <a-progress :percent="t.targetCount ? Math.round((t.successCount / t.targetCount) * 100) : 0" stroke-color="#159a5e" />
                  <footer>
                    <span>成功 {{ t.successCount }} · 失败 {{ t.failedCount }}</span>
                    <a-button v-if="t.status === 'scheduled'" size="small" type="primary" @click="openExecuteOta(t)">开始升级</a-button>
                  </footer>
                </section>
              </div>
              <a-modal
                :open="Boolean(otaTarget)"
                title="确认OTA目标与固件"
                :confirm-loading="otaSaving"
                :ok-button-props="{ disabled: !otaGatewayIds.length || !otaUrl.trim() }"
                @cancel="!otaSaving && (otaTarget = null)"
                @ok="submitExecuteOta"
              >
                <p>仅选择与任务主体一致的网关；固件必须为稳定版且具有完整SHA-256。执行窗口仅作参考，本次确认后即可领取，有效期30分钟。接入端须验证固件签名、型号兼容及摘要，按指令编号幂等执行。</p>
                <a-select v-model:value="otaGatewayIds" mode="multiple" style="width: 100%" placeholder="选择目标网关" :options="otaGatewayOptions" />
                <p style="word-break: break-all; margin-top: 10px">
                  固件：{{ otaFirmware?.firmwareName }} · {{ otaFirmware?.versionName }}<br />
                  型号：{{ otaFirmware?.targetModel }}<br />
                  SHA-256：{{ otaFirmware?.sha256Text }}<br />
                  下载地址：{{ otaUrl || '尚未读取到完整固件包资料，禁止启动' }}
                </p>
              </a-modal>
            </div>

            <!-- 运维工单 -->
            <div v-else-if="page === 'workorders'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>运维工单</h1><p>用户报修与运营处理共用台账：待受理→处理中→已完成，保留实际处理结果。</p></div></div>
              <AgriAntdvListTable
                :columns="workOrderColumns"
                :data="filteredWorkOrders"
                row-key="id"
                client-pagination
                column-settings-storage-key="iot-ops:workorders"
                @refresh="loadWorkOrders"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="applyWorkOrderFilter" @reset="resetWorkOrderFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="workOrderDraft"
                        allow-clear
                        placeholder="工单号 / 所属主体 / 设备 / 报修描述"
                        @press-enter="applyWorkOrderFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>工单状态</label>
                      <a-select
                        v-model:value="workOrderStatusFilter"
                        :options="workOrderStatusOptions"
                        @change="applyWorkOrderFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-tenantName="{ record }">{{ record.tenantName || '未归属' }}</template>
                <template #cell-description="{ record }">{{ record.description || '—' }}</template>
                <template #cell-priority="{ record }"><a-tag :class="`o-status tone-${statusMeta(String(record.priority ?? '')).tone}`">{{ statusMeta(String(record.priority ?? '')).label }}</a-tag></template>
                <template #cell-status="{ record }"><a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag></template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="workOrderRowActions(record as unknown as WorkOrder)" />
                </template>
              </AgriAntdvListTable>
              <a-modal
                :open="Boolean(workOrderTarget)"
                :title="workOrderTarget?.status === 'pending' ? '受理运维工单' : '登记实际维修完成结果'"
                :confirm-loading="workOrderSaving"
                @cancel="!workOrderSaving && (workOrderTarget = null)"
                @ok="submitWorkOrder"
              >
                <a-textarea v-model:value="workOrderNote" :rows="4" :maxlength="200" show-count placeholder="实际处理进展或完成结果；不会自动改变设备心跳" />
              </a-modal>
            </div>

            <!-- 统计分析 -->
            <div v-else-if="page === 'reports'" class="o-page">
              <div v-if="!reportData" class="o-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="o-title">
                  <div><span>IOT PLATFORM · OPERATIONS</span><h1>统计分析</h1><p>租户接入、协议分布、网关运行与告警统计。</p></div>
                  <div class="o-actions"><a-button @click="exportOpsReport">导出报表</a-button></div>
                </div>
                <div class="o-card" style="margin-bottom: 14px">
                  <div class="o-stat-row">
                    <span><small>在册设备</small><b>{{ reportData.summary.devices }}</b></span>
                    <span><small>在线设备</small><b>{{ reportData.summary.online }}</b></span>
                    <span><small>待处置告警</small><b>{{ reportData.summary.openAlerts }}</b></span>
                    <span><small>未完成工单</small><b>{{ reportData.summary.openWorkOrders }}</b></span>
                    <span><small>遥测读数</small><b>{{ reportData.summary.dataPoints }}</b></span>
                    <span><small>控制指令</small><b>{{ reportData.summary.controls }}</b></span>
                  </div>
                </div>
                <div class="o-dashboard-grid">
                  <section class="o-card">
                    <div class="o-card-head"><div><b>租户接入排行</b><small>设备规模</small></div></div>
                    <div v-for="(t, i) in reportData.tenantRank" :key="t.id" class="o-rank">
                      <span>{{ i + 1 }}</span>
                      <div><b>{{ t.tenantName }}</b><small>{{ t.planName }} · {{ t.region }}</small></div>
                      <em>{{ t.deviceCount }}</em>
                    </div>
                  </section>
                  <section class="o-card">
                    <div class="o-card-head"><div><b>协议连接量</b><small>实时连接</small></div></div>
                    <div v-for="p in reportData.protocols" :key="p.id" class="o-protocol">
                      <span><ApiOutlined /></span>
                      <div><b>{{ p.protocolName }}</b><small>{{ p.protocolType }}</small></div>
                      <em>{{ p.connections }}</em>
                      <a-tag :class="`o-status tone-${statusMeta(p.status).tone}`">{{ statusMeta(p.status).label }}</a-tag>
                    </div>
                  </section>
                </div>
              </template>
            </div>

            <!-- 操作审计日志 -->
            <div v-else-if="page === 'logs'" class="o-page">
              <div class="o-title"><div><span>IOT PLATFORM · OPERATIONS</span><h1>操作审计日志</h1><p>设备接入、告警处置、租户配额和 OTA 等敏感操作留痕；操作人取自登录令牌，来源 IP 由网关透传。</p></div></div>
              <AgriAntdvListTable
                :columns="logColumns"
                :data="filteredLogs"
                row-key="id"
                client-pagination
                column-settings-storage-key="iot-ops:logs"
                @refresh="loadLogs"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="1" @search="applyLogFilter" @reset="resetLogFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="logDraft"
                        allow-clear
                        placeholder="操作人 / 动作 / 对象 / 详情"
                        @press-enter="applyLogFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-actionType="{ record }"><a-tag>{{ record.action }}</a-tag></template>
                <template #cell-ip="{ record }">{{ record.ip || '—' }}</template>
              </AgriAntdvListTable>
            </div>
          </main>
        </div>
      </div>
    </UnifiedSsoGate>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import {
  AlertOutlined,
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  SlidersOutlined,
  TeamOutlined,
  ToolOutlined,
} from '@ant-design/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import { AgriAntdvListTable } from '@agri/shared/vue/antdv'
import { AgriVueFilterBar, AgriVueRowActions, type VueListColumn, type VueRowActionItem } from '@agri/shared/vue/list'
import {
  opsApi,
  STATUS,
  type AccessAudit,
  type Alert,
  type AlertRule,
  type Device,
  type FirmwarePackage,
  type Gateway,
  type OpsOverview,
  type OtaTask,
  type Product,
  type Protocol,
  type Tenant,
  type WorkOrder,
} from './api'
import { downloadCsv, stampFilename } from '../../shared-ui/exportCsv'
import { useClock } from '../../shared-ui/vue/useClock'
import { iotSession } from '../../shared-ui/vue/sso'
import UnifiedSsoGate from '../../shared-ui/vue/UnifiedSsoGate.vue'
import DeviceSampling from '../../shared-ui/vue/DeviceSampling.vue'
import CommandReceipts from '../../shared-ui/vue/CommandReceipts.vue'
import WorkspaceNavigation from '../../shared-ui/vue/WorkspaceNavigation.vue'
import AccountMenu from '../../shared-ui/vue/AccountMenu.vue'
import SidebarUserCard from '../../shared-ui/vue/SidebarUserCard.vue'

type Page =
  | 'dashboard'
  | 'tenants'
  | 'firmwares'
  | 'devices'
  | 'gateways'
  | 'alerts'
  | 'rules'
  | 'products'
  | 'access'
  | 'ota'
  | 'workorders'
  | 'reports'
  | 'logs'

const PAGES: Page[] = [
  'dashboard',
  'tenants',
  'firmwares',
  'devices',
  'gateways',
  'alerts',
  'rules',
  'products',
  'access',
  'ota',
  'workorders',
  'reports',
  'logs',
]

const TITLES: Record<Page, string> = {
  dashboard: '运营概览大屏',
  tenants: '租户与配额',
  firmwares: '固件包管理',
  devices: '平台设备监控',
  gateways: '网关运维',
  alerts: '告警运营中心',
  rules: '阈值规则治理',
  products: '产品与协议管理',
  access: '设备接入审核',
  ota: 'OTA 升级运营',
  workorders: '运维工单',
  reports: '统计分析',
  logs: '操作审计日志',
}

const MENU = [
  {
    group: '运营总览',
    items: [
      { page: 'dashboard', label: '运营概览大屏', icon: DashboardOutlined },
      { page: 'reports', label: '统计分析', icon: BarChartOutlined },
    ],
  },
  {
    group: '设备与接入',
    items: [
      { page: 'devices', label: '平台设备监控', icon: CloudServerOutlined },
      { page: 'gateways', label: '网关运维', icon: ApiOutlined },
      { page: 'products', label: '产品与协议', icon: AppstoreOutlined },
      { page: 'access', label: '设备接入审核', icon: ShopOutlined },
    ],
  },
  {
    group: '告警治理',
    items: [
      { page: 'alerts', label: '告警运营中心', icon: AlertOutlined },
      { page: 'rules', label: '阈值规则治理', icon: SlidersOutlined },
    ],
  },
  {
    group: '运维与升级',
    items: [
      { page: 'workorders', label: '运维工单', icon: ToolOutlined },
      { page: 'firmwares', label: '固件包管理', icon: DatabaseOutlined },
      { page: 'ota', label: 'OTA 升级运营', icon: ReloadOutlined },
    ],
  },
  {
    group: '主体与审计',
    items: [
      { page: 'tenants', label: '租户与配额', icon: TeamOutlined },
      { page: 'logs', label: '操作审计日志', icon: DatabaseOutlined },
    ],
  },
]

const OPS_PERMISSIONS = ['iot:admin']
const ROUTER_BASE = (import.meta.env.VITE_ROUTER_BASE || '/').replace(/\/$/, '')
const baseUrl = import.meta.env.BASE_URL
const userPortalUrl = `${window.location.protocol}//${window.location.hostname}:8101/`

const theme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorLink: '#2d8f4e',
    colorText: '#1a1a1a',
    colorTextSecondary: '#595959',
    colorBorder: '#e8e8e8',
    colorBgLayout: '#f5f6fa',
    borderRadius: 6,
    controlHeight: 36,
    fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
  },
}

function parse(): Page {
  const relative =
    ROUTER_BASE && window.location.pathname.startsWith(ROUTER_BASE)
      ? window.location.pathname.slice(ROUTER_BASE.length)
      : window.location.pathname
  const p = relative.replace(/^\//, '').split('/')[0] as Page
  return PAGES.includes(p) ? p : 'dashboard'
}

function go(target: Page) {
  window.history.pushState({}, '', `${ROUTER_BASE}/${target}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function statusMeta(value: string) {
  return STATUS[value] ?? { label: value, tone: 'gray' }
}

const clock = useClock()
const page = ref<Page>(parse())
const collapsed = ref(window.innerWidth >= 1024 && window.innerWidth < 1280)
const isMobile = ref(window.innerWidth < 1024)
const mobileOpen = ref(false)
const pendingAuditsCount = ref(0)

function toggleSidebar() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value
  else collapsed.value = !collapsed.value
}

// 概览
const overview = ref<OpsOverview | null>(null)
const maxTypeVal = computed(() => Math.max(...(overview.value?.typeDistribution.map((t) => t.value) ?? [1]), 1))
async function loadOverview() {
  try {
    overview.value = await opsApi.overview()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载概览失败')
  }
}

// 租户
const tenants = ref<Tenant[]>([])
const tenantDraft = ref('')
const tenantKeyword = ref('')
const tenantStatusFilter = ref('all')
const tenantStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '正常' },
  { value: 'trial', label: '试用' },
  { value: 'suspended', label: '已停用' },
]
const filteredTenants = computed(() => {
  const q = tenantKeyword.value.trim().toLowerCase()
  return tenants.value.filter((t) => {
    if (tenantStatusFilter.value !== 'all' && t.status !== tenantStatusFilter.value) return false
    if (!q) return true
    return `${t.tenantName} ${t.tenantCode} ${t.region} ${t.planName}`.toLowerCase().includes(q)
  })
})
const quotaTarget = ref<Tenant | null>(null)
const quotaLimit = ref(500)
const tenantColumns: VueListColumn[] = [
  { label: '租户', key: 'tenantName', prop: 'tenantName', width: 220, locked: true },
  { label: '套餐', key: 'planName', prop: 'planName', width: 130 },
  { label: '设备数', key: 'usage', width: 180 },
  { label: '到期', key: 'expireDate', prop: 'expireDate', width: 140 },
  { label: '状态', key: 'status', prop: 'status', width: 100 },
  { label: '操作', key: 'action', width: 120, fixed: 'right' },
]
async function loadTenants() {
  try {
    tenants.value = await opsApi.tenants()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载租户失败')
  }
}
function applyTenantFilter() {
  tenantKeyword.value = tenantDraft.value.trim()
}
function resetTenantFilter() {
  tenantDraft.value = ''
  tenantKeyword.value = ''
  tenantStatusFilter.value = 'all'
}
function tenantRowActions(row: Tenant): VueRowActionItem[] {
  return [{ key: 'quota', label: '调整配额', onClick: () => openQuotaModal(row) }]
}
function openQuotaModal(r: Tenant) {
  quotaTarget.value = r
  quotaLimit.value = r.deviceLimit
}
async function saveQuota() {
  if (!quotaTarget.value) return
  try {
    await opsApi.updateQuota(quotaTarget.value.id, quotaLimit.value)
    quotaTarget.value = null
    message.success('租户配额已更新')
    tenants.value = await opsApi.tenants()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '更新失败')
  }
}

// 设备
const deviceStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' },
  { value: 'alert', label: '告警' },
]
const devices = ref<Device[]>([])
const deviceStatus = ref('all')
const deviceKeyword = ref('')
const commandDevice = ref<Device | null>(null)
const samplingDevice = ref<Device | null>(null)
const deviceColumns: VueListColumn[] = [
  { label: '设备', key: 'deviceName', prop: 'deviceName', width: 210, locked: true },
  { label: '租户 / 农场', key: 'tenant', width: 190 },
  { label: '协议', key: 'protocol', prop: 'protocol', width: 110 },
  { label: '在线状态', key: 'onlineStatus', prop: 'onlineStatus', width: 100 },
  { label: '信号', key: 'rssi', prop: 'rssi', width: 100 },
  { label: '电量', key: 'battery', prop: 'battery', width: 90 },
  { label: '最近上报', key: 'lastReport', prop: 'lastReport', width: 160 },
  { label: '固件', key: 'firmwareVersion', prop: 'firmwareVersion', width: 120 },
  { label: '操作', key: 'action', fixed: 'right', width: 160 },
]
function deviceRowActions(row: Device): VueRowActionItem[] {
  return [
    { key: 'sampling', label: '采样配置', onClick: () => { samplingDevice.value = row } },
    { key: 'commands', label: '指令回执', onClick: () => { commandDevice.value = row } },
  ]
}
async function loadDevices() {
  try {
    devices.value = await opsApi.devices({
      keyword: deviceKeyword.value,
      status: deviceStatus.value === 'all' ? undefined : deviceStatus.value,
    })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载设备失败')
  }
}
function resetDevices() {
  deviceStatus.value = 'all'
  deviceKeyword.value = ''
  void loadDevices()
}

// 网关
const gateways = ref<Gateway[]>([])
const receiptGateway = ref<Gateway | null>(null)
function confirmRestartGateway(g: Gateway) {
  Modal.confirm({
    title: '申请重启网关',
    content: '重启可能中断挂载设备通信。申请不代表执行成功，请按指令回执核验。',
    onOk: async () => {
      try {
        await opsApi.restartGateway(g.id)
        message.info('重启申请已登记，请查看回执；未确认网关执行')
        gateways.value = await opsApi.gateways()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '操作失败')
      }
    },
  })
}

// 告警
const alerts = ref<Alert[]>([])
const alertDraft = ref('')
const alertKeyword = ref('')
const alertLevelFilter = ref('all')
const alertStatusFilter = ref('all')
const alertLevelOptions = [
  { value: 'all', label: '全部级别' },
  { value: 'critical', label: '紧急' },
  { value: 'major', label: '重要' },
  { value: 'minor', label: '一般' },
]
const alertStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'handling', label: '处理中' },
  { value: 'resolved', label: '已处理' },
]
const filteredAlerts = computed(() => {
  const q = alertKeyword.value.trim().toLowerCase()
  return alerts.value.filter((a) => {
    if (alertLevelFilter.value !== 'all' && a.level !== alertLevelFilter.value) return false
    if (alertStatusFilter.value !== 'all' && a.status !== alertStatusFilter.value) return false
    if (!q) return true
    return `${a.title} ${a.alertNo} ${a.deviceName} ${a.tenantName} ${a.content}`.toLowerCase().includes(q)
  })
})
const alertTarget = ref<Alert | null>(null)
const alertNote = ref('')
const alertColumns: VueListColumn[] = [
  { label: '告警', key: 'title', prop: 'title', width: 220, locked: true },
  { label: '设备', key: 'deviceName', prop: 'deviceName', width: 160 },
  { label: '级别', key: 'level', prop: 'level', width: 90 },
  { label: '状态', key: 'status', prop: 'status', width: 100 },
  { label: '告警信息', key: 'content', prop: 'content', width: 240, ellipsis: true },
  { label: '发生时间', key: 'createdAt', prop: 'createdAt', width: 160 },
  { label: '操作', key: 'action', fixed: 'right', width: 160 },
]
function applyAlertFilter() {
  alertKeyword.value = alertDraft.value.trim()
}
function resetAlertFilter() {
  alertDraft.value = ''
  alertKeyword.value = ''
  alertLevelFilter.value = 'all'
  alertStatusFilter.value = 'all'
}
function alertRowActions(row: Alert): VueRowActionItem[] {
  const actions: VueRowActionItem[] = [
    { key: 'workorder', label: '创建工单', onClick: () => go('workorders') },
  ]
  if (row.status !== 'resolved') {
    actions.push({ key: 'handle', label: '登记处置', onClick: () => openHandleAlert(row) })
  }
  return actions
}
async function loadAlerts() {
  try {
    alerts.value = await opsApi.alerts()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载告警失败')
  }
}
function openHandleAlert(row: Alert) {
  alertTarget.value = row
  alertNote.value = ''
}
async function submitHandleAlert() {
  if (!alertTarget.value) return
  if (alertNote.value.trim().length < 4) {
    message.error('请填写不少于 4 个字的处置说明')
    return
  }
  try {
    await opsApi.handleAlert(alertTarget.value.id, alertNote.value.trim(), alertTarget.value.status === 'pending' ? 'handling' : 'resolved')
    alertTarget.value = null
    alertNote.value = ''
    message.success('告警已处置')
    await loadAlerts()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

// 阈值规则
const platformRules = ref<AlertRule[]>([])
const tenantRules = ref<AlertRule[]>([])
const ruleOptions = ref<Awaited<ReturnType<typeof opsApi.alertRuleOptions>> | null>(null)
const editingRule = ref<AlertRule | null>(null)
const ruleModalOpen = ref(false)
const ruleForm = reactive<{
  ruleName: string
  metricKey: string
  deviceType?: string
  operator: string
  threshold?: number
  durationSeconds: number
  level: string
  enabled: boolean
}>({
  ruleName: '',
  metricKey: '',
  deviceType: undefined,
  operator: '>',
  threshold: undefined,
  durationSeconds: 0,
  level: 'major',
  enabled: true,
})
const ruleMetricOptions = computed(
  () => ruleOptions.value?.metrics.map((i) => ({ value: i.key, label: `${i.name}${i.unit ? `（${i.unit}）` : ''}` })) ?? [],
)
const ruleDeviceTypeOptions = computed(
  () => ruleOptions.value?.deviceTypes.map((v) => ({ value: v, label: v })) ?? [],
)
const ruleOperatorOptions = computed(
  () => ruleOptions.value?.operators.map((v) => ({ value: v, label: v })) ?? [],
)
const ruleLevelOptions = computed(
  () =>
    ruleOptions.value?.levels.map((v) => ({
      value: v,
      label: v === 'critical' ? '紧急' : v === 'major' ? '重要' : '一般',
    })) ?? [],
)
const platformRuleColumns: VueListColumn[] = [
  { label: '规则', key: 'ruleName', prop: 'ruleName', width: 200, locked: true },
  { label: '指标范围', key: 'metric', width: 180 },
  { label: '条件', key: 'cond', width: 110 },
  { label: '持续', key: 'duration', width: 100 },
  { label: '等级', key: 'level', width: 90 },
  { label: '状态', key: 'enabled', width: 100 },
  { label: '操作', key: 'action', width: 150, fixed: 'right' },
]
const tenantRuleColumns: VueListColumn[] = [
  { label: '经营主体', key: 'tenantName', prop: 'tenantName', width: 180, locked: true },
  { label: '规则', key: 'ruleName', prop: 'ruleName', width: 190 },
  { label: '指标范围', key: 'metric', width: 180 },
  { label: '条件', key: 'cond', width: 110 },
  { label: '持续', key: 'duration', width: 100 },
  { label: '等级', key: 'level', width: 90 },
  { label: '状态', key: 'enabled', width: 100 },
]
function platformRuleRowActions(row: AlertRule): VueRowActionItem[] {
  return [
    { key: 'edit', label: '编辑', onClick: () => openRuleForm(row) },
    { key: 'toggle', label: row.enabled ? '停用' : '启用', onClick: () => void toggleRule(row) },
    { key: 'delete', label: '删除', danger: true, onClick: () => removeRule(row) },
  ]
}
async function loadRules() {
  const [preset, own, opts] = await Promise.all([opsApi.alertRules(), opsApi.tenantAlertRules(), opsApi.alertRuleOptions()])
  platformRules.value = preset
  tenantRules.value = own
  ruleOptions.value = opts
}
function openRuleForm(rule: AlertRule | null) {
  editingRule.value = rule
  if (rule) {
    ruleForm.ruleName = rule.ruleName
    ruleForm.metricKey = rule.metricKey
    ruleForm.deviceType = rule.deviceType || undefined
    ruleForm.operator = rule.operator
    ruleForm.threshold = Number(rule.threshold)
    ruleForm.durationSeconds = rule.durationSeconds
    ruleForm.level = rule.level
    ruleForm.enabled = rule.enabled
  } else {
    ruleForm.ruleName = ''
    ruleForm.metricKey = ruleOptions.value?.metrics[0]?.key ?? ''
    ruleForm.deviceType = undefined
    ruleForm.operator = '>'
    ruleForm.threshold = undefined
    ruleForm.durationSeconds = 0
    ruleForm.level = 'major'
    ruleForm.enabled = true
  }
  ruleModalOpen.value = true
}
async function saveRule() {
  if (!ruleForm.ruleName.trim() || !ruleForm.metricKey || ruleForm.threshold === undefined) {
    message.warning('请完整填写规则名称、指标与阈值')
    return
  }
  try {
    if (editingRule.value) await opsApi.updateAlertRule(editingRule.value.id, { ...ruleForm })
    else await opsApi.createAlertRule({ ...ruleForm })
    ruleModalOpen.value = false
    message.success('指标告警规则已保存')
    await loadRules()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  }
}
async function toggleRule(rule: AlertRule) {
  try {
    await opsApi.toggleAlertRule(rule.id)
    message.success('平台阈值规则状态已更新')
    await loadRules()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}
function removeRule(rule: AlertRule) {
  Modal.confirm({
    title: `删除平台规则「${rule.ruleName}」？`,
    okText: '确认删除',
    okButtonProps: { danger: true },
    content: '删除后使用该指标的主体将回落到其他可用平台规则；已产生的告警不受影响。',
    onOk: async () => {
      await opsApi.deleteAlertRule(rule.id)
      message.success('平台指标规则已删除')
      await loadRules()
    },
  })
}

// 产品与协议
const products = ref<Product[]>([])
const protocols = ref<Protocol[]>([])
const productColumns: VueListColumn[] = [
  { label: '产品', key: 'productName', prop: 'productName', width: 220, locked: true },
  { label: '品类', key: 'category', prop: 'category', width: 110 },
  { label: '协议', key: 'protocol', prop: 'protocol', width: 100 },
  { label: '属性', key: 'propertyCount', prop: 'propertyCount', width: 85, kind: 'number' },
  { label: '设备', key: 'deviceCount', prop: 'deviceCount', width: 85, kind: 'number' },
  { label: '状态', key: 'status', prop: 'status', width: 95 },
]
async function loadProducts() {
  try {
    const [p, x] = await Promise.all([opsApi.products(), opsApi.protocols()])
    products.value = p
    protocols.value = x
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载产品与协议失败')
  }
}

// 接入审核
const accessAudits = ref<AccessAudit[]>([])
const accessDraft = ref('')
const accessKeyword = ref('')
const accessStatusFilter = ref('all')
const accessStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
]
const filteredAccessAudits = computed(() => {
  const q = accessKeyword.value.trim().toLowerCase()
  return accessAudits.value.filter((a) => {
    if (accessStatusFilter.value !== 'all' && a.status !== accessStatusFilter.value) return false
    if (!q) return true
    return `${a.deviceName} ${a.deviceCode} ${a.tenantName} ${a.requestType}`.toLowerCase().includes(q)
  })
})
const accessTarget = ref<{ row: AccessAudit; status: string } | null>(null)
const accessNote = ref('')
const accessSaving = ref(false)
const accessColumns: VueListColumn[] = [
  { label: '设备', key: 'deviceName', prop: 'deviceName', width: 210, locked: true },
  { label: '所属主体', key: 'tenantName', prop: 'tenantName', width: 160 },
  { label: '提交时间', key: 'submittedAt', prop: 'submittedAt', width: 160 },
  { label: '审核人', key: 'auditor', prop: 'auditor', width: 110 },
  { label: '状态', key: 'status', prop: 'status', width: 100 },
  { label: '审核意见', key: 'note', prop: 'note', width: 220, ellipsis: true },
  { label: '操作', key: 'action', fixed: 'right', width: 150 },
]
function applyAccessFilter() {
  accessKeyword.value = accessDraft.value.trim()
}
function resetAccessFilter() {
  accessDraft.value = ''
  accessKeyword.value = ''
  accessStatusFilter.value = 'all'
}
function accessRowActions(row: AccessAudit): VueRowActionItem[] {
  return [
    { key: 'approve', label: '通过接入', onClick: () => openAccessReview(row, 'approved') },
    { key: 'reject', label: '驳回', danger: true, onClick: () => openAccessReview(row, 'rejected') },
  ]
}
async function loadAccessAudits() {
  try {
    accessAudits.value = await opsApi.accessAudits()
    pendingAuditsCount.value = accessAudits.value.filter((r) => r.status === 'pending').length
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  }
}
function openAccessReview(row: AccessAudit, status: string) {
  accessTarget.value = { row, status }
  accessNote.value = ''
}
async function submitAccessReview() {
  if (!accessTarget.value) return
  if (accessNote.value.trim().length < 4) {
    message.error('请填写不少于 4 个字的审核意见')
    return
  }
  accessSaving.value = true
  try {
    await opsApi.reviewAccess(accessTarget.value.row.id, accessTarget.value.status, accessNote.value.trim())
    message.success('接入审核已更新')
    accessTarget.value = null
    accessNote.value = ''
    await loadAccessAudits()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    accessSaving.value = false
  }
}

// 固件包
const firmwares = ref<FirmwarePackage[]>([])
const fwLoading = ref(false)
const fwType = ref<string | undefined>(undefined)
const fwStatus = ref<string | undefined>(undefined)
const fwModel = ref('')
const fwModalOpen = ref(false)
const fwSaving = ref(false)
const fwUploading = ref(false)
const fwUploaded = ref(false)
const fwExpectedHash = ref('')
const fwDetailTarget = ref<FirmwarePackage | null>(null)
const deprecatingFwId = ref<number | null>(null)
const deprecateReason = ref('')
const fwForm = reactive({
  firmwareName: '',
  versionName: '',
  firmwareType: 'gateway',
  targetModel: 'ALL',
  packageUrl: '',
  fileSizeBytes: undefined as number | undefined,
  sha256Text: '',
  releaseNotes: '',
  changelogText: '',
})
const fwTypeOptions = [
  { value: 'gateway', label: '边缘网关' },
  { value: 'sensor', label: '传感器' },
  { value: 'controller', label: '控制器' },
]
const fwStatusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'stable', label: '已发布稳定版' },
  { value: 'deprecated', label: '已废弃' },
]
const fwColumns: VueListColumn[] = [
  { label: 'ID', key: 'id', prop: 'id', width: 80, kind: 'number' },
  { label: '固件名称与版本', key: 'name', width: 240, locked: true },
  { label: '包大小', key: 'fileSizeBytes', prop: 'fileSizeBytes', width: 110 },
  { label: 'SHA-256 完整摘要', key: 'sha256Text', prop: 'sha256Text', width: 220 },
  { label: '状态', key: 'status', prop: 'status', width: 120 },
  { label: '更新说明', key: 'releaseNotes', prop: 'releaseNotes', width: 220, ellipsis: true },
  { label: '登记时间', key: 'createdAt', prop: 'createdAt', width: 160 },
  { label: '操作', key: 'action', width: 160, fixed: 'right' },
]
function resetFirmwares() {
  fwType.value = undefined
  fwStatus.value = undefined
  fwModel.value = ''
  void loadFirmwares()
}
function fwRowActions(row: FirmwarePackage): VueRowActionItem[] {
  const actions: VueRowActionItem[] = [
    { key: 'detail', label: '详情', onClick: () => { fwDetailTarget.value = row } },
  ]
  if (row.status === 'draft') {
    actions.push({ key: 'publish', label: '发布稳定版', onClick: () => confirmPublishFirmware(row) })
  }
  if (row.status === 'stable') {
    actions.push({ key: 'deprecate', label: '下线废弃', danger: true, onClick: () => openDeprecateFirmware(row.id) })
  }
  return actions
}
async function loadFirmwares() {
  fwLoading.value = true
  try {
    firmwares.value = await opsApi.listFirmwarePackages({
      type: fwType.value || undefined,
      status: fwStatus.value || undefined,
      model: fwModel.value.trim() || undefined,
    })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载固件包失败')
  } finally {
    fwLoading.value = false
  }
}
function openRegisterFirmware() {
  fwUploaded.value = false
  fwExpectedHash.value = ''
  fwForm.firmwareName = ''
  fwForm.versionName = ''
  fwForm.firmwareType = 'gateway'
  fwForm.targetModel = 'ALL'
  fwForm.packageUrl = ''
  fwForm.fileSizeBytes = undefined
  fwForm.sha256Text = ''
  fwForm.releaseNotes = ''
  fwForm.changelogText = ''
  fwModalOpen.value = true
}
async function handleFirmwareFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size === 0 || file.size > 268435456) {
    message.error('请选择大于0且不超过256MB的固件文件')
    return
  }
  fwUploading.value = true
  try {
    const result = await opsApi.uploadFirmwarePackage(file, fwExpectedHash.value.trim())
    fwForm.packageUrl = result.packageUrl
    fwForm.sha256Text = result.sha256Text
    fwForm.fileSizeBytes = result.fileSizeBytes
    fwUploaded.value = true
    message.success('上传完成，服务端已计算并核验SHA-256及大小')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '上传失败')
  } finally {
    fwUploading.value = false
  }
}
async function submitRegisterFirmware() {
  if (fwUploading.value) return
  if (!fwForm.firmwareName.trim() || !fwForm.versionName.trim() || !fwForm.packageUrl.trim() || !fwForm.fileSizeBytes || !fwForm.sha256Text.trim()) {
    message.warning('请填写完整的固件包资料')
    return
  }
  fwSaving.value = true
  try {
    const result = await opsApi.registerFirmwarePackage({ ...fwForm })
    const saved = await opsApi.getFirmwarePackage(result.id)
    if (
      saved.versionName !== fwForm.versionName.trim() ||
      saved.packageUrl !== fwForm.packageUrl.trim() ||
      saved.sha256Text !== fwForm.sha256Text.trim().toLowerCase()
    ) {
      throw new Error('服务端保存回读不一致，请刷新核对，勿重复登记')
    }
    message.success('固件草稿包登记成功')
    fwModalOpen.value = false
    await loadFirmwares()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '登记失败')
  } finally {
    fwSaving.value = false
  }
}
function confirmPublishFirmware(r: FirmwarePackage) {
  Modal.confirm({
    title: '发布稳定版后包资料不可更改',
    content: '请确认已核验固件来源、型号和摘要。托管文件将重新核验摘要与大小；外部地址仅校验登记资料。均不代替真机兼容验收。',
    onOk: async () => {
      try {
        await opsApi.publishFirmwarePackage(r.id)
        if ((await opsApi.getFirmwarePackage(r.id)).status !== 'stable') {
          throw new Error('发布状态回读未确认')
        }
        message.success('固件包已发布为稳定版')
        await loadFirmwares()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '发布失败')
      }
    },
  })
}
function openDeprecateFirmware(id: number) {
  deprecateReason.value = ''
  deprecatingFwId.value = id
}
async function submitDeprecateFirmware() {
  if (deprecatingFwId.value === null) return
  try {
    await opsApi.deprecateFirmwarePackage(deprecatingFwId.value, deprecateReason.value)
    if ((await opsApi.getFirmwarePackage(deprecatingFwId.value)).status !== 'deprecated') {
      throw new Error('废弃状态回读未确认')
    }
    deprecatingFwId.value = null
    deprecateReason.value = ''
    message.success('固件包已废弃')
    await loadFirmwares()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

// OTA
const otaTasks = ref<OtaTask[]>([])
const otaTarget = ref<OtaTask | null>(null)
const otaGateways = ref<Gateway[]>([])
const otaGatewayIds = ref<number[]>([])
const otaUrl = ref('')
const otaFirmware = ref<FirmwarePackage | null>(null)
const otaSaving = ref(false)
const otaGatewayOptions = computed(() =>
  otaGateways.value.map((g) => ({ value: g.id, label: `${g.gatewayName} · ${g.id}` })),
)
async function openExecuteOta(t: OtaTask) {
  otaTarget.value = t
  otaGatewayIds.value = []
  otaUrl.value = ''
  otaFirmware.value = null
  otaGateways.value = []
  try {
    const [gs, fw] = await Promise.all([opsApi.gateways(), opsApi.getFirmwarePackage(t.firmwareId)])
    if (fw.status !== 'stable' || !fw.packageUrl || !fw.fileSizeBytes) {
      throw new Error('该任务关联固件缺少完整包资料或未发布')
    }
    otaFirmware.value = fw
    otaUrl.value = fw.packageUrl
    otaGateways.value = gs.filter((g) => fw.firmwareType === 'gateway' && (fw.targetModel === 'ALL' || fw.targetModel === g.model))
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载固件信息失败')
  }
}
async function submitExecuteOta() {
  if (!otaTarget.value || otaSaving.value) return
  otaSaving.value = true
  try {
    await opsApi.executeOta(otaTarget.value.id, otaGatewayIds.value, otaUrl.value)
    otaTarget.value = null
    message.success('升级申请已保存，等待网关领取与真实执行回执')
    otaTasks.value = await opsApi.ota()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '执行失败')
  } finally {
    otaSaving.value = false
  }
}

// 工单
const workOrders = ref<WorkOrder[]>([])
const workOrderDraft = ref('')
const workOrderKeyword = ref('')
const workOrderStatusFilter = ref('all')
const workOrderStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待受理' },
  { value: 'processing', label: '处理中' },
  { value: 'completed', label: '已完成' },
]
const filteredWorkOrders = computed(() => {
  const q = workOrderKeyword.value.trim().toLowerCase()
  return workOrders.value.filter((w) => {
    if (workOrderStatusFilter.value !== 'all' && w.status !== workOrderStatusFilter.value) return false
    if (!q) return true
    return `${w.orderNo} ${w.tenantName || ''} ${w.deviceName} ${w.description || ''} ${w.technician || ''}`.toLowerCase().includes(q)
  })
})
const workOrderTarget = ref<WorkOrder | null>(null)
const workOrderNote = ref('')
const workOrderSaving = ref(false)
const workOrderColumns: VueListColumn[] = [
  { label: '工单', key: 'orderNo', prop: 'orderNo', width: 150, locked: true },
  { label: '所属主体', key: 'tenantName', prop: 'tenantName', width: 150 },
  { label: '设备', key: 'deviceName', prop: 'deviceName', width: 150 },
  { label: '来源', key: 'source', prop: 'source', width: 100 },
  { label: '类型', key: 'type', prop: 'type', width: 100 },
  { label: '报修描述', key: 'description', prop: 'description', width: 210, ellipsis: true },
  { label: '优先级', key: 'priority', prop: 'priority', width: 90 },
  { label: '处理人', key: 'technician', prop: 'technician', width: 100 },
  { label: '状态', key: 'status', prop: 'status', width: 100 },
  { label: '创建', key: 'createdAt', prop: 'createdAt', width: 160 },
  { label: '操作', key: 'action', fixed: 'right', width: 130 },
]
async function loadWorkOrders() {
  try {
    workOrders.value = await opsApi.workOrders()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载工单失败')
  }
}
function applyWorkOrderFilter() {
  workOrderKeyword.value = workOrderDraft.value.trim()
}
function resetWorkOrderFilter() {
  workOrderDraft.value = ''
  workOrderKeyword.value = ''
  workOrderStatusFilter.value = 'all'
}
function workOrderRowActions(row: WorkOrder): VueRowActionItem[] {
  return [
    {
      key: 'handle',
      label: row.status === 'pending' ? '受理工单' : '登记完成',
      disabled: !['pending', 'processing'].includes(row.status),
      onClick: () => openHandleWorkOrder(row),
    },
  ]
}
function openHandleWorkOrder(row: WorkOrder) {
  workOrderTarget.value = row
  workOrderNote.value = ''
}
async function submitWorkOrder() {
  if (!workOrderTarget.value) return
  if (workOrderNote.value.trim().length < 4) {
    message.error('请填写不少于4字的实际说明')
    return
  }
  workOrderSaving.value = true
  try {
    await opsApi.handleWorkOrder(
      workOrderTarget.value.id,
      workOrderTarget.value.status === 'pending' ? 'processing' : 'completed',
      workOrderNote.value.trim(),
    )
    workOrders.value = await opsApi.workOrders()
    workOrderTarget.value = null
    message.success('工单状态已保存并回读')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    workOrderSaving.value = false
  }
}

// 统计与日志
const reportData = ref<Awaited<ReturnType<typeof opsApi.reports>> | null>(null)
function exportOpsReport() {
  if (!reportData.value) return
  const count = downloadCsv(
    stampFilename('物联网运营统计'),
    [
      { key: 'item', title: '统计项' },
      { key: 'value', title: '数值' },
    ],
    [
      { item: '接入租户数', value: reportData.value.summary.tenants },
      { item: '在册设备数', value: reportData.value.summary.devices },
      { item: '在线设备数', value: reportData.value.summary.online },
      { item: '累计告警', value: reportData.value.summary.alerts },
      { item: '待处置告警', value: reportData.value.summary.openAlerts },
      { item: '运维工单', value: reportData.value.summary.workOrders },
      { item: '未完成工单', value: reportData.value.summary.openWorkOrders },
      { item: '控制指令', value: reportData.value.summary.controls },
      { item: '遥测读数', value: reportData.value.summary.dataPoints },
    ],
  )
  message.success(`已导出 ${count} 项统计`)
}

const logs = ref<Awaited<ReturnType<typeof opsApi.logs>>>([])
const logDraft = ref('')
const logKeyword = ref('')
const filteredLogs = computed(() => {
  const q = logKeyword.value.trim().toLowerCase()
  if (!q) return logs.value
  return logs.value.filter((item) =>
    `${item.operator || ''} ${item.action || ''} ${item.target || ''} ${item.detail || ''} ${item.ip || ''}`
      .toLowerCase()
      .includes(q),
  )
})
const logColumns: VueListColumn[] = [
  { label: '时间', key: 'createdAt', prop: 'createdAt', width: 170, locked: true },
  { label: '操作人', key: 'operator', prop: 'operator', width: 130 },
  { label: '动作', key: 'actionType', prop: 'action', width: 140 },
  { label: '对象', key: 'target', prop: 'target', width: 180 },
  { label: '详情', key: 'detail', prop: 'detail', width: 260, ellipsis: true },
  { label: '来源 IP', key: 'ip', prop: 'ip', width: 140 },
]
async function loadLogs() {
  try {
    logs.value = await opsApi.logs()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载审计日志失败')
  }
}
function applyLogFilter() {
  logKeyword.value = logDraft.value.trim()
}
function resetLogFilter() {
  logDraft.value = ''
  logKeyword.value = ''
}

let pollTimer: number | null = null
function stopPoll() {
  if (pollTimer != null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

async function loadPage(current: Page) {
  stopPoll()
  if (!iotSession.user) return
  opsApi.accessAudits().then((rows) => {
    pendingAuditsCount.value = rows.filter((r) => r.status === 'pending').length
  }).catch(() => { pendingAuditsCount.value = 0 })

  try {
    if (current === 'dashboard') {
      await loadOverview()
    } else if (current === 'tenants') {
      tenants.value = await opsApi.tenants()
    } else if (current === 'devices') {
      await loadDevices()
    } else if (current === 'gateways') {
      gateways.value = await opsApi.gateways()
    } else if (current === 'alerts') {
      await loadAlerts()
      pollTimer = window.setInterval(() => void loadAlerts(), 30000)
    } else if (current === 'rules') {
      await loadRules()
    } else if (current === 'products') {
      const [p, x] = await Promise.all([opsApi.products(), opsApi.protocols()])
      products.value = p
      protocols.value = x
    } else if (current === 'access') {
      await loadAccessAudits()
    } else if (current === 'firmwares') {
      await loadFirmwares()
    } else if (current === 'ota') {
      otaTasks.value = await opsApi.ota()
      pollTimer = window.setInterval(() => void opsApi.ota().then((d) => { otaTasks.value = d }).catch(() => {}), 10000)
    } else if (current === 'workorders') {
      workOrders.value = await opsApi.workOrders()
    } else if (current === 'reports') {
      reportData.value = await opsApi.reports()
    } else if (current === 'logs') {
      logs.value = await opsApi.logs()
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  }
}

const syncLayout = () => {
  const w = window.innerWidth
  isMobile.value = w < 1024
  if (w >= 1024 && w < 1280) collapsed.value = true
  else if (w >= 1280) collapsed.value = false
  if (w >= 1024) mobileOpen.value = false
}
const onPopState = () => { page.value = parse() }

watch(
  () => iotSession.user,
  (user) => {
    if (!user) return
    const latest = parse()
    if (page.value !== latest) page.value = latest
  },
)

watch(
  () => [iotSession.user, page.value] as const,
  ([user, current]) => {
    if (user) void loadPage(current)
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('resize', syncLayout)
  window.addEventListener('popstate', onPopState)
})

onBeforeUnmount(() => {
  stopPoll()
  window.removeEventListener('resize', syncLayout)
  window.removeEventListener('popstate', onPopState)
})
</script>
