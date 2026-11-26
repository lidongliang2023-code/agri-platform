import { defineComponent, h, onBeforeUnmount, ref, watch, type PropType, type VNodeChild } from 'vue'
import { Button, DatePicker, Input, InputNumber, Modal, Radio, Select, Space, message } from 'ant-design-vue'
import { Form, useFormModel } from '@agri/shared/vue/antdv/jsxUi'
import type { FormModel } from '@agri/shared/vue/antdv/formModel'

type Values = Record<string, any>
const formProps = {
  form: Object as PropType<FormModel>,
  formRef: Object as PropType<{ value?: FormModel | null; current?: FormModel | null }>,
  initialValues: Object as PropType<Values>,
  scrollToFirstError: [Boolean, Object],
  labelCol:Object, wrapperCol:Object,
  grid: Boolean,
  rowProps: Object,
  colProps: Object,
  onFinish: Function as PropType<(values: any) => boolean | void | Promise<boolean | void>>,
  onValuesChange: Function as PropType<(changed: Values, all: Values) => void>,
  submitter: { type: [Object, Boolean] as PropType<false | { submitButtonProps?: Record<string, any>; resetButtonProps?: Record<string, any>; searchConfig?: { submitText?: string; resetText?: string }; render?: (props: Values, buttons: VNodeChild[]) => VNodeChild }>, default: () => ({}) },
  layout: { type: String as PropType<'horizontal' | 'vertical' | 'inline'>, default: 'vertical' },
}
export const ProForm = defineComponent({
  name: 'ProductionVueForm', inheritAttrs: false, props: formProps,
  setup(props, { attrs, slots, expose }) {
    const form = props.form ?? useFormModel()
    const submitting = ref(false)
    form.bind(undefined, props.initialValues)
    let previous = { ...form.model }
    watch(form.model, values => {
      const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => previous[key] !== value))
      previous = { ...values }
      if (Object.keys(changed).length) props.onValuesChange?.(changed, { ...values })
    }, { deep: true })
    watch(() => props.formRef, target => { if (target) { target.value = form; target.current = form } }, { immediate: true })
    onBeforeUnmount(() => { if (props.formRef) { props.formRef.value = null; props.formRef.current = null } })
    expose(form)
    async function finish(values: Values) {
      if (submitting.value) return false
      submitting.value = true
      try { return await props.onFinish?.(values) }
      finally { submitting.value = false }
    }
    return () => h(Form, { ...attrs, form, labelCol:props.labelCol,wrapperCol:props.wrapperCol,scrollToFirstError:props.scrollToFirstError, layout: props.layout, initialValues: props.initialValues, onFinish: finish }, {
      default: () => {
        const config = props.submitter === false ? undefined : props.submitter.searchConfig
        const buttons = [h(Button, { ...(props.submitter && props.submitter.resetButtonProps), onClick: () => form.resetFields() }, () => config?.resetText ?? '重置'), h(Button, { type: 'primary', htmlType: 'submit', ...(props.submitter && props.submitter.submitButtonProps), loading: submitting.value }, () => config?.submitText ?? '提交')]
        return [slots.default?.(), props.submitter !== false ? h(Space, {}, () => props.submitter && props.submitter.render ? props.submitter.render({ form, submit: () => form.submit(), reset: () => form.resetFields() }, buttons) : buttons) : null]
      },
    })
  },
})

export const ModalForm = defineComponent({
  name: 'ProductionVueModalForm', inheritAttrs: false,
  props: { ...formProps, open: Boolean, title: null as unknown as PropType<VNodeChild>, width: [String, Number], trigger: null as unknown as PropType<VNodeChild>, modalProps: Object as PropType<Record<string, any>>, onOpenChange: Function as PropType<(open: boolean) => void> },
  setup(props, { attrs, slots }) {
    const form = props.form ?? useFormModel()
    const localOpen = ref(false)
    const submitting = ref(false)
    const setOpen = (open: boolean) => {
      if (submitting.value) return
      if (open) { form.resetFields(); form.setFieldsValue(props.initialValues ?? {}) }
      localOpen.value = open; props.onOpenChange?.(open)
    }
    watch(() => props.open, open => {
      localOpen.value = open
      if (open) {
        form.resetFields()
        form.setFieldsValue(props.initialValues ?? {})
      }
    }, { immediate: true, flush: 'post' })
    async function finish(values: Values) {
      if (submitting.value) return false
      submitting.value = true
      try {
        const result = await props.onFinish?.(values)
        if (result === true) { localOpen.value = false; props.onOpenChange?.(false); form.resetFields() }
        return result
      } finally { submitting.value = false }
    }
    return () => [props.trigger ? h('span', { onClick: () => setOpen(true) }, props.trigger) : null,
      h(Modal, { ...props.modalProps, open: localOpen.value, title: props.title, width: props.width, confirmLoading: submitting.value, onCancel: () => setOpen(false), onOk: () => { void form.submit().catch(error => message.error(error.message)) } }, {
        default: () => h(ProForm, { ...attrs, ...props, form, submitter: false, onFinish: finish }, slots),
      })]
  },
})

const fieldProps = {
  name: [String, Number, Array] as PropType<string | number | (string | number)[]>,
  label: null as unknown as PropType<VNodeChild>,
  rules: Array as PropType<any[]>,
  initialValue: null,
  placeholder: [String, Array] as PropType<string | string[]>,
  fieldProps: Object as PropType<Record<string, any>>,
  formItemProps: Object as PropType<Record<string, any>>,
  width: [String, Number],
  disabled: Boolean,
  readonly: Boolean,
  hidden: Boolean,
  options: Array as PropType<any[]>,
  valueEnum: Object as PropType<Record<string, string | { text: string }>>,
  request: Function as PropType<(params: Record<string, unknown>) => Promise<any[]>>,
  params: Object as PropType<Record<string, unknown>>,
  colProps: Object as PropType<Record<string, any>>,
  showSearch: Boolean,
  allowClear:{type:Boolean,default:true},
  extra:null as unknown as PropType<VNodeChild>,
  tooltip:String,
  mode: String,
  min: Number,
  max: Number,
}
function field(name: string, control: any, extra: Record<string, unknown> = {}) {
  return defineComponent({
    name, inheritAttrs: false, props: fieldProps,
    setup(props, { attrs, slots }) {
      const remote = ref<any[]>([])
      let epoch = 0
      watch(() => [props.request, props.params], async (_value, _old, cleanup) => {
        const id = ++epoch
        let cancelled = false
        cleanup(() => { cancelled = true })
        if (!props.request) return
        try { const result = await props.request(props.params ?? {}); if (!cancelled && id === epoch) remote.value = result }
        catch (error) { if (!cancelled && id === epoch) message.error(error instanceof Error ? error.message : '选项加载失败') }
      }, { immediate: true, deep: true })
      return () => {
        if (props.hidden) return null
        const options = props.options ?? (props.valueEnum ? Object.entries(props.valueEnum).map(([value, text]) => ({ value, label: typeof text === 'string' ? text : text.text })) : remote.value)
        const widths: Record<string, number> = { xs: 104, sm: 216, md: 328, lg: 440, xl: 552 }
        const width = typeof props.width === 'string' ? widths[props.width] ?? props.width : props.width
        return h(Form.Item, { ...props.formItemProps, name: props.name, label: props.label, extra:props.extra, tooltip:props.tooltip, rules: props.rules, initialValue: props.initialValue }, {
          default: () => h(control, { ...extra, ...attrs, min: props.min, max: props.max, allowClear:props.allowClear, showSearch: props.showSearch, mode: props.mode, placeholder: props.placeholder, disabled: props.disabled, readonly: props.readonly, ...(control === Select || control === Radio.Group ? { options } : {}), style: { width: typeof width === 'number' ? `${width}px` : width ?? '100%' }, ...props.fieldProps }, slots),
        })
      }
    },
  })
}
export const ProFormText = field('ProductionFormText', Input)
export const ProFormTextArea = field('ProductionFormTextArea', Input.TextArea)
export const ProFormDigit = field('ProductionFormDigit', InputNumber)
export const ProFormSelect = field('ProductionFormSelect', Select, { allowClear: true })
export const ProFormDatePicker = field('ProductionFormDatePicker', DatePicker)
export const ProFormDateTimePicker = field('ProductionFormDateTimePicker', DatePicker, { showTime: true })
export const ProFormRadio = Object.assign(field('ProductionFormRadio', Radio), { Group: field('ProductionFormRadioGroup', Radio.Group) })
