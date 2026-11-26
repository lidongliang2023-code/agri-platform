import { reactive, shallowRef } from 'vue'
import type { FormInstance } from 'ant-design-vue'
export type FormValues = Record<string, any>
export function useFormModel() {
  const model = reactive<FormValues>({})
  const instance = shallowRef<FormInstance>()
  const initial: FormValues = {}
  let baseline = '{}'
  let finish: ((values: FormValues) => unknown) | undefined
  const clone = (value: FormValues) => JSON.parse(JSON.stringify(value)) as FormValues
  const pathOf = (key: string | number | (string | number)[]) => (Array.isArray(key) ? key : [key])
  const readPath = (target: FormValues, key: string | number | (string | number)[]) =>
    pathOf(key).reduce<any>((obj, segment) => obj?.[segment], target)
  const writePath = (target: FormValues, key: string | number | (string | number)[], value: unknown) => {
    const path = pathOf(key)
    if (!path.length) return
    let obj: any = target
    for (let i = 0; i < path.length - 1; i++) {
      obj[path[i]] ??= typeof path[i + 1] === 'number' ? [] : {}
      obj = obj[path[i]]
    }
    obj[path[path.length - 1]] = value
  }
  const fieldErrors = shallowRef<Array<{ name: (string | number)[]; errors: string[] }>>([])
  const listValidators = new Map<string, () => Promise<void>>()
  return {
    model, instance,
    bind(handler?: (values: FormValues) => unknown, defaults?: FormValues) {
      finish = handler
      if (defaults) for (const [key, value] of Object.entries(defaults)) {
        initial[key] = value
        if (!(key in model)) model[key] = value
      }
    },
    registerListValidator(key: string, validator?: () => Promise<void>) {
      if (validator) listValidators.set(key, validator)
      else listValidators.delete(key)
    },
    setFieldsValue(values: FormValues) { Object.assign(model, values); baseline = JSON.stringify(model) },
    setFieldValue(key: string | number | (string | number)[], value: unknown) { writePath(model, key, value); baseline = JSON.stringify(model) },
    getFieldValue(key: string | number | (string | number)[]) { return readPath(model, key) },
    resetFields() {
      Object.keys(model).forEach(key => delete model[key]); Object.assign(model, clone(initial));
      baseline = JSON.stringify(model); fieldErrors.value = []; instance.value?.clearValidate()
    },
    isFieldsTouched() { return JSON.stringify(model) !== baseline },
    getFieldsValue() { return { ...model } },
    getFieldsError() { return fieldErrors.value },
    recordErrors(errors: Array<{ name: (string | number)[]; errors: string[] }>) { fieldErrors.value = errors },
    scrollToField(name: string | number | (string | number)[], options?: any) {
      ;(instance.value as any)?.scrollToField?.(name, options)
    },
    async validateFields(names?: Parameters<FormInstance['validate']>[0]): Promise<FormValues> {
      if (!instance.value) throw new Error('表单尚未就绪')
      try { await instance.value.validate(names); fieldErrors.value = [] } catch (error) { fieldErrors.value = (error as { errorFields?: typeof fieldErrors.value }).errorFields ?? []; throw error }
      if (!names) for (const run of listValidators.values()) await run()
      return clone(model)
    },
    async submit() { try { const values = await this.validateFields(); await finish?.(values) } catch (error) { if (error instanceof Error) throw error } },
  }
}
export type FormModel = ReturnType<typeof useFormModel>
