import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
/**
 * 页面名称：对接规则配置
 * 路由路径：/admin/trade/p2t/rules
 * 所属模块：系统配置 / 产销对接
 *
 * 审核 / 建品 / 回写三组规则存交易端；规则变更留版本号，
 * 已发生的业务按当时规则执行，不追溯改判。
 */

import { Button, Card, Col, Input, Row, Tag, message } from "@/vue/ui";
import { getP2tRules, saveP2tRule } from '@/api/p2t';
import type { P2tRule } from '@/api/p2t';
const RULE_LABEL: Record<string, string> = {
  AUDIT: '审核规则',
  LISTING: '建品规则',
  WRITEBACK: '回写规则'
};
const P2tRules = defineComponent({
  name: "P2tRules",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const rules = shallowRef<P2tRule[]>([]);
    const setRules = (next: typeof rules.value | ((previous: typeof rules.value) => typeof rules.value)) => {
      rules.value = typeof next === 'function' ? (next as (previous: typeof rules.value) => typeof rules.value)(rules.value) : next;
    };
    const drafts = shallowRef<Record<string, string>>({});
    const setDrafts = (next: typeof drafts.value | ((previous: typeof drafts.value) => typeof drafts.value)) => {
      drafts.value = typeof next === 'function' ? (next as (previous: typeof drafts.value) => typeof drafts.value)(drafts.value) : next;
    };
    const load = (): void => {
      getP2tRules().then((res: {
        code: number;
        data?: P2tRule[];
      }) => {
        if (res?.code === 200) {
          const list = res.data ?? [];
          setRules(list);
          setDrafts(Object.fromEntries(list.map(r => [r.ruleCode, r.ruleJson])));
        }
      }).catch(() => message.error('加载规则失败'));
    };
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          load();
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    const save = async (code: string): Promise<void> => {
      const res = await saveP2tRule(code, drafts.value[code] ?? '{}');
      if (res?.code === 200) {
        message.success('规则已保存，新版本已生效');
        load();
      } else {
        message.error(res?.message ?? '保存失败');
      }
    };
    return () => {
      return <div style={{
        padding: 20
      }}>
      <Row gutter={16}>
        {rules.value.map(rule => <Col span={8} key={rule.ruleCode}>
            <Card title={RULE_LABEL[rule.ruleCode] ?? rule.ruleCode} extra={<Tag color="blue">{rule.version ?? 'RULE-P2T-V4'}</Tag>} actions={[<Button key="save" type="link" onClick={() => void save(rule.ruleCode)}>保存配置</Button>]}>
              <Input.TextArea rows={10} value={drafts.value[rule.ruleCode] ?? ''} onChange={e => setDrafts({
                ...drafts.value,
                [rule.ruleCode]: e.target.value ?? ''
              })} style={{
                fontFamily: 'ui-monospace, Consolas, monospace',
                fontSize: 12
              }} />
            </Card>
          </Col>)}
      </Row>
      {rules.value.length === 0 && <Card>暂无规则配置（数据库补丁未应用时会为空）</Card>}
    </div>;
    };
  }
});
export default P2tRules;
