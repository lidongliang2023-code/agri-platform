/**
 * 页面名称：对接规则配置
 * 路由路径：/admin/trade/p2t/rules
 * 所属模块：系统配置 / 产销对接
 *
 * 审核 / 建品 / 回写三组规则存交易端；规则变更留版本号，
 * 已发生的业务按当时规则执行，不追溯改判。
 */
import { useEffect, useState } from 'react'
import { Button, Card, Col, Input, Row, Tag, message } from 'antd'
import { getP2tRules, saveP2tRule } from '@/api/p2t'
import type { P2tRule } from '@/api/p2t'

const RULE_LABEL: Record<string, string> = {
  AUDIT: '审核规则',
  LISTING: '建品规则',
  WRITEBACK: '回写规则',
}

export default function P2tRules(): JSX.Element {
  const [rules, setRules] = useState<P2tRule[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const load = (): void => {
    getP2tRules().then((res: { code: number; data?: P2tRule[] }) => {
      if (res?.code === 200) {
        const list = res.data ?? []
        setRules(list)
        setDrafts(Object.fromEntries(list.map((r) => [r.ruleCode, r.ruleJson])))
      }
    }).catch(() => message.error('加载规则失败'))
  }

  useEffect(() => { load() }, [])

  const save = async (code: string): Promise<void> => {
    const res = await saveP2tRule(code, drafts[code] ?? '{}')
    if (res?.code === 200) {
      message.success('规则已保存，新版本已生效')
      load()
    } else {
      message.error(res?.message ?? '保存失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16}>
        {rules.map((rule) => (
          <Col span={8} key={rule.ruleCode}>
            <Card
              title={RULE_LABEL[rule.ruleCode] ?? rule.ruleCode}
              extra={<Tag color="blue">{rule.version ?? 'RULE-P2T-V4'}</Tag>}
              actions={[<Button key="save" type="link" onClick={() => void save(rule.ruleCode)}>保存配置</Button>]}
            >
              <Input.TextArea
                rows={10}
                value={drafts[rule.ruleCode] ?? ''}
                onChange={(e) => setDrafts({ ...drafts, [rule.ruleCode]: e.target.value })}
                style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 12 }}
              />
            </Card>
          </Col>
        ))}
      </Row>
      {rules.length === 0 && <Card>暂无规则配置（数据库补丁未应用时会为空）</Card>}
    </div>
  )
}
