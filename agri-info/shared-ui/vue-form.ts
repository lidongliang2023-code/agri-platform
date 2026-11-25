import { reactive, shallowRef, type FormHTMLAttributes } from 'vue'
import type { FormInstance } from 'ant-design-vue'
export type FormValues = Record<string, any>
export function useFormModel() {
  const model = reactive<FormValues>({})
  const instance = shallowRef<FormInstance>()
  const initial: FormValues = {}
  let baseline = '{}'
  let finish: ((values: FormValues) => unknown) | undefined
  const clone = (value: FormValues) => JSON.parse(JSON.stringify(value)) as FormValues
  return {
    model, instance,
    bind(handler?: (values: FormValues) => unknown, defaults?: FormValues) {
      finish = handler
      if (defaults) for (const [key, value] of Object.entries(defaults)) {
        initial[key] = value
        if (!(key in model)) model[key] = value
      }
    },
    setFieldsValue(values: FormValues) { Object.assign(model, values); baseline = JSON.stringify(model) },
    setFieldValue(key: string, value: unknown) { model[key] = value; baseline = JSON.stringify(model) },
    getFieldValue(key: string) { return model[key] },
    resetFields() {
      Object.keys(model).forEach(key => delete model[key]); Object.assign(model, clone(initial));
      baseline = JSON.stringify(model); instance.value?.clearValidate()
    },
    isFieldsTouched() { return JSON.stringify(model) !== baseline },
    async validateFields(): Promise<FormValues> {
      if (!instance.value) throw new Error('表单尚未就绪')
      await instance.value.validate(); return clone(model)
    },
    async submit() { try { const values = await this.validateFields(); await finish?.(values) } catch (error) { if (error instanceof Error) throw error } },
  }
}
export type FormModel = ReturnType<typeof useFormModel>
