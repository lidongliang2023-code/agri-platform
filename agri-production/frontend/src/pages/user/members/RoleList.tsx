/**
 * 页面名称：角色与权限
 * 路由路径：/production/members/roles
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #10（对应 PRD 3.4 RBAC 权限模型 / 8.1 FARM-08）
 *
 * 页面用途（PRD）：角色管理、权限分配、数据范围设置。
 * 权限点命名遵循 `{域}.{资源}.{动作}`；数据范围支持
 * SELF / PLOT / FARM / TENANT 等取值（PRD 3.4 + 平台级扩展）。
 *
 * 数据说明：
 * - 角色列表 = 平台域真实数据 `GET /api/v1/admin/roles`（platform_role 全表），
 *   接口不可用 / 返回空时显示空态，不回落到任何本地角色目录；
 * - 权限读取 = `GET /api/v1/admin/roles/{code}/permissions`（真实落库值），
 *   **不再**读生产域 `/members/roles/permissions`（后端是硬编码空壳，固定返回
 *   produce:read / produce:write / produce:admin 三个与数据库无关的假权限码）；
 * - 权限写入 = `PUT /api/v1/admin/roles/{code}/permissions`，失败明确报错，
 *   **不再**用 localStorage 伪造「已保存」；
 * - 在职人数来自生产域 `GET /members/roles`（按 role_code 聚合），
 *   该端点不返回人数时显示「—」，不补 0。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  App as AntdApp,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import {
  InfoCircleOutlined,
  KeyOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchPlatformRoles,
  fetchRolePermissions,
  fetchRoles,
  saveRolePermissions,
} from '@/api/production-view'
import type { PlatformRole } from '@/api/production-view'
import {
  DATA_SCOPE_OPTIONS,
  PERMISSION_GROUPS,
  ROLE_CATALOG,
  ROLE_DEFAULT_PERMISSIONS,
  dataScopeLabel,
  flattenPermissions,
  roleName,
} from '@/utils/production-adapter'

/** 角色视图模型（数据全部来自平台域 platform_role，不做任何本地编造） */
interface RoleRow {
  /** 角色编码 */
  roleCode: string
  /** 角色名称（后端 platform_role.name） */
  roleName: string
  /** 平台域权限码（后端 platform_role.permissions） */
  permissions: string[]
  /** 在职人数；后端 `/members/roles` 未提供时为 null */
  memberCount: number | null
  /** 默认数据范围（来自角色目录，仅作展示建议，非后端数据） */
  defaultScope: string
  /** 是否在 PRD 3.1 角色目录中（用于补充职责说明） */
  known: boolean
  /** 职责说明（命中角色目录时展示，未命中显示「—」） */
  duty: string
}

/**
 * 角色与权限
 * @returns 页面内容
 */
export default function RoleList(): JSX.Element {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState<string>('')
  const [activeRoleCode, setActiveRoleCode] = useState<string>('')
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
  const [checkedCodes, setCheckedCodes] = useState<string[]>([])
  const [dataScope, setDataScope] = useState<string>('FARM')

  /** 平台域真实角色列表（authoritative：platform_role 全表） */
  const platformRolesQuery = useQuery({
    queryKey: ['platform-roles'],
    queryFn: () => fetchPlatformRoles(),
  })

  /** 生产域角色在职人数（按 role_code 聚合，仅作人数展示） */
  const memberCountQuery = useQuery({
    queryKey: ['role-member-count'],
    queryFn: () => fetchRoles(),
    retry: false,
  })

  const permissionQuery = useQuery({
    queryKey: ['role-permissions', activeRoleCode],
    queryFn: () => fetchRolePermissions(activeRoleCode),
    enabled: activeRoleCode !== '',
    retry: false,
  })

  /** 角色表格行：由平台域真实角色 + 生产域在职人数拼装，无数据即空态 */
  const roleRows = useMemo<RoleRow[]>(() => {
    const countMap = new Map(
      (memberCountQuery.data ?? []).map((item) => [item.roleCode, item.memberCount ?? 0]),
    )
    const rows = (platformRolesQuery.data ?? []).map((role: PlatformRole): RoleRow => {
      const catalog = ROLE_CATALOG.find((item) => item.roleCode === role.code)
      return {
        roleCode: role.code,
        roleName: role.name || catalog?.roleName || role.code,
        permissions: role.permissions,
        memberCount: countMap.has(role.code) ? (countMap.get(role.code) as number) : null,
        defaultScope: catalog?.defaultScope ?? 'TENANT',
        known: Boolean(catalog),
        duty: catalog?.description ?? '',
      }
    })
    return rows.filter((row) => {
      if (!keyword.trim()) return true
      const text = `${row.roleName}${row.roleCode}${row.duty}`
      return text.toLowerCase().includes(keyword.trim().toLowerCase())
    })
  }, [keyword, platformRolesQuery.data, memberCountQuery.data])

  /** 权限点目录扁平列表 */
  const permissionPoints = useMemo(() => flattenPermissions(), [])

  useEffect(() => {
    // 只信任服务端已配置的权限码；后端返回空数组表示「该角色确实没配权限」，
    // 不再用角色模板兜底——否则用户会以为这些是服务端已保存的权限。
    if (activeRoleCode && permissionQuery.isSuccess) {
      setCheckedCodes(permissionQuery.data ?? [])
    }
  }, [activeRoleCode, permissionQuery.data, permissionQuery.isSuccess])

  useEffect(() => {
    if (activeRoleCode) {
      setDataScope(
        ROLE_CATALOG.find((item) => item.roleCode === activeRoleCode)?.defaultScope ?? 'TENANT',
      )
    }
  }, [activeRoleCode])

  const saveMutation = useMutation({
    mutationFn: (payload: { roleCode: string; codes: string[] }) =>
      saveRolePermissions(payload.roleCode, payload.codes),
    onSuccess: (result) => {
      message.success(result.message)
      setDrawerOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['platform-roles'] })
      void queryClient.invalidateQueries({ queryKey: ['role-permissions', activeRoleCode] })
    },
    onError: (error: Error) => {
      // 写失败必须明确告知，绝不提示「已保存」
      message.error(error.message || '权限保存失败：后端暂不支持权限写入')
    },
  })

  /**
   * 打开权限抽屉
   * @param row 角色行
   * @returns void
   */
  function openDrawer(row: RoleRow): void {
    setActiveRoleCode(row.roleCode)
    // 以服务端已保存的权限为准，不预填角色模板（模板只是「一键填充」按钮的快捷方式）
    setCheckedCodes(row.permissions)
    setDataScope(row.defaultScope)
    setDrawerOpen(true)
    void permissionQuery.refetch()
  }

  /**
   * 全选 / 取消全选某个功能域
   * @param domain 功能域前缀
   * @param groupResources 资源列表
   * @param groupActions 动作列表
   * @param checked 是否选中
   * @returns void
   */
  function toggleGroup(
    domain: string,
    groupResources: { code: string; name: string }[],
    groupActions: string[],
    checked: boolean,
  ): void {
    setCheckedCodes((prev) => {
      const next = new Set(prev)
      for (const resource of groupResources) {
        for (const action of groupActions) {
          const code = `${domain}.${resource.code}.${action}`
          if (checked) next.add(code)
          else next.delete(code)
        }
      }
      return Array.from(next)
    })
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#13a05a' }} />
            <span>角色与权限</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              权限点命名规范：{`{域}.{资源}.{动作}`}，如 produce.task.create
            </Typography.Text>
          </Space>
        }
        extra={
          <Space>
            <Input.Search
              allowClear
              placeholder="搜索角色名称 / 编码"
              style={{ width: 220 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void platformRolesQuery.refetch()
                void memberCountQuery.refetch()
              }}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Statistic
              title="服务端角色数"
              value={platformRolesQuery.data?.length ?? 0}
              suffix="个"
            />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="权限点总数" value={permissionPoints.length} suffix="个" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="功能域数" value={PERMISSION_GROUPS.length} suffix="个" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title="在岗成员数"
              value={(memberCountQuery.data ?? []).reduce(
                (sum, item) => sum + (item.memberCount ?? 0),
                0,
              )}
              suffix="人"
            />
          </Col>
        </Row>
      </Card>

      {platformRolesQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="角色接口不可用，无法读取服务端角色"
          description="平台域 /api/v1/admin/roles 与本农场角色目录都读取失败。若只是平台域失败，页面会用本农场角色（成员台账聚合）兜底展示；两者都失败请确认后端服务是否已启动，当前账号是否具备平台角色读取权限（403 表示无权限，不是服务没起）。下方列表不显示任何本地示例角色。"
          action={
            <Button size="small" onClick={() => void platformRolesQuery.refetch()}>
              重试
            </Button>
          }
        />
      ) : null}

      <Card>
        {platformRolesQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : roleRows.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              keyword.trim()
                ? '没有匹配的角色'
                : '服务端暂无角色数据（platform_role 表为空或接口未返回数据）'
            }
          />
        ) : (
          <Table<RoleRow>
            rowKey="roleCode"
            dataSource={roleRows}
            pagination={false}
            columns={[
              {
                title: '角色名称',
                dataIndex: 'roleName',
                width: 160,
                render: (_value, row) => (
                  <Space>
                    <KeyOutlined style={{ color: '#1677ff' }} />
                    <Typography.Text strong>{row.roleName}</Typography.Text>
                  </Space>
                ),
              },
              {
                title: '角色编码',
                dataIndex: 'roleCode',
                width: 160,
                render: (value: string) => <Tag color="blue">{value}</Tag>,
              },
              {
                title: '已配置权限',
                dataIndex: 'permissions',
                width: 120,
                render: (value: string[]) => (
                  <Tag color={value.length > 0 ? 'green' : 'default'}>{value.length} 个</Tag>
                ),
              },
              {
                title: '职责说明',
                dataIndex: 'duty',
                render: (_value, row) =>
                  row.duty ? (
                    <Typography.Text type="secondary">{row.duty}</Typography.Text>
                  ) : (
                    <Tooltip title="该角色不在 PRD 3.1 角色目录中，后端未返回职责描述">
                      <Typography.Text type="secondary">
                        —
                        <InfoCircleOutlined
                          style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }}
                        />
                      </Typography.Text>
                    </Tooltip>
                  ),
              },
              {
                title: '默认数据范围',
                dataIndex: 'defaultScope',
                width: 160,
                render: (value: string) => <Tag color="green">{dataScopeLabel(value)}</Tag>,
              },
              {
                title: '在岗人数',
                dataIndex: 'memberCount',
                width: 110,
                render: (value: number | null) =>
                  value === null ? (
                    <Tooltip title="后端 /members/roles 未返回该角色的人数，显示为「—」">
                      <Typography.Text type="secondary">
                        —
                        <InfoCircleOutlined
                          style={{ fontSize: 11, color: '#faad14', marginLeft: 2 }}
                        />
                      </Typography.Text>
                    </Tooltip>
                  ) : (
                    <Badge count={value} showZero color="#13a05a" />
                  ),
              },
              {
                title: '操作',
                key: 'option',
                width: 160,
                render: (_value, row) => (
                  <Button type="link" icon={<ThunderboltOutlined />} onClick={() => openDrawer(row)}>
                    配置权限
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Drawer
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#13a05a' }} />
            <span>权限分配 · {roleName(activeRoleCode)}</span>
          </Space>
        }
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Select
              size="small"
              style={{ width: 220 }}
              value={dataScope}
              onChange={(value: string) => setDataScope(value)}
              options={DATA_SCOPE_OPTIONS}
            />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ roleCode: activeRoleCode, codes: checkedCodes })}
            >
              保存权限
            </Button>
          </Space>
        }
      >
        {permissionQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="权限来源与生效说明"
              description="下方勾选框是前端 RBAC 权限点目录（命名规范 {域}.{资源}.{动作}）；已勾选状态读取自服务端 platform_role.permissions，点击「保存权限」会真实写入服务端（PUT /api/v1/admin/roles/{code}/permissions）。保存失败会明确报错，不会假装成功。"
            />
            {permissionQuery.isError ? (
              <Alert
                type="error"
                showIcon
                message="未能读取该角色已保存的权限"
                description="GET /api/v1/admin/roles/{code}/permissions 请求失败。此处不回落到本地示例权限，也不按「未配置」处理；请重试或确认后端平台服务可用。"
                action={
                  <Button size="small" onClick={() => void permissionQuery.refetch()}>
                    重试
                  </Button>
                }
              />
            ) : null}
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="角色编码">{activeRoleCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="已选权限点">
                <Tag color="green">{checkedCodes.length} 个</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="数据范围" span={2}>
                <Tag color="blue">{dataScopeLabel(dataScope)}</Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  数据范围叠加在功能权限之上，遵循 PRD R-AUTH-02（tenant_id + farm_id 双重过滤）
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>

            <Space>
              <Typography.Text type="secondary">快捷操作：</Typography.Text>
              <Button
                size="small"
                onClick={() => setCheckedCodes(permissionPoints.map((item) => item.code))}
              >
                全选
              </Button>
              <Button size="small" onClick={() => setCheckedCodes([])}>
                清空
              </Button>
              <Button
                size="small"
                onClick={() => setCheckedCodes(ROLE_DEFAULT_PERMISSIONS[activeRoleCode] ?? [])}
              >
                按角色模板填充
              </Button>
            </Space>

            {PERMISSION_GROUPS.map((group) => {
              const groupCodes = group.resources.flatMap((resource) =>
                group.actions.map((action) => `${group.domain}.${resource.code}.${action}`),
              )
              const selectedCount = groupCodes.filter((code) => checkedCodes.includes(code)).length
              const allChecked = selectedCount === groupCodes.length && groupCodes.length > 0
              const partialChecked = selectedCount > 0 && !allChecked
              return (
                <Card
                  key={group.domain}
                  size="small"
                  title={
                    <Space>
                      <Checkbox
                        checked={allChecked}
                        indeterminate={partialChecked}
                        onChange={(event) =>
                          toggleGroup(
                            group.domain,
                            group.resources,
                            group.actions,
                            event.target.checked,
                          )
                        }
                      />
                      <span>{group.domainName}</span>
                      <Tag>{`${selectedCount}/${groupCodes.length}`}</Tag>
                    </Space>
                  }
                >
                  {group.resources.map((resource) => (
                    <div key={`${group.domain}-${resource.code}`} style={{ marginBottom: 8 }}>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
                        {resource.name}
                        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                          {group.domain}.{resource.code}.*
                        </Typography.Text>
                      </Typography.Text>
                      <Checkbox.Group
                        options={group.actions.map((action) => ({
                          label: formatActionLabel(action),
                          value: `${group.domain}.${resource.code}.${action}`,
                        }))}
                        value={checkedCodes}
                        onChange={(values) => setCheckedCodes(values as string[])}
                      />
                    </div>
                  ))}
                </Card>
              )
            })}
            <Divider />
            <Space direction="vertical" size={2}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                · 内置角色不可删除；自定义角色请在团队成员页邀请后按角色编码授权。
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                · 数据范围取多角色并集中的最大授权范围（PRD R-AUTH-03）。
              </Typography.Text>
            </Space>
          </Space>
        )}
      </Drawer>
    </Space>
  )
}

/**
 * 动作编码转中文
 * @param action 动作编码
 * @returns 中文标签
 */
function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    view: '查看',
    create: '新增',
    update: '编辑',
    delete: '删除',
    export: '导出',
    run: '调用',
    verify: '验真',
    submit: '提交',
  }
  return labels[action] ?? action
}
