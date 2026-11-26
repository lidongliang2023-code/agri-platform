import { computed, reactive, toValue, type MaybeRefOrGetter } from 'vue'
import {
  useQuery as useVueQuery,
  useMutation as useVueMutation,
  useQueries as useVueQueries,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/vue-query'
export { QueryClient, VueQueryPlugin, useQueryClient } from '@tanstack/vue-query'

/** getter 保留参数响应式；reactive 解包查询结果，页面仍读取 query.data / isPending。 */
export function useQuery<TQueryFnData = unknown, TError = Error, TData = TQueryFnData>(options: MaybeRefOrGetter<UseQueryOptions<TQueryFnData, TError, TData, TQueryFnData, QueryKey>>) {
  const resolved = computed(() => toValue(options)) as unknown as UseQueryOptions<TQueryFnData, TError, TData, TQueryFnData, QueryKey>
  return reactive(useVueQuery(resolved))
}
export function useMutation<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(options: MaybeRefOrGetter<UseMutationOptions<TData, TError, TVariables, TContext>>) {
  const resolved = computed(() => toValue(options)) as unknown as UseMutationOptions<TData, TError, TVariables, TContext>
  return reactive(useVueMutation(resolved))
}
/** 多查询页面兼容 getter 包装，自动保持 queries 数组响应式。 */
export function useQueries<T>(options: MaybeRefOrGetter<{ queries: readonly { queryKey: readonly unknown[]; queryFn: (...args: any[]) => Promise<T>; [key: string]: any }[] }>) {
  const queries = computed(() => toValue(options).queries)
  return useVueQueries({ queries } as any) as unknown as import('vue').ComputedRef<Array<import('@tanstack/vue-query').QueryObserverResult<T, Error>>>
}
