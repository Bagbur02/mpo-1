import { reactive, ref, Ref, toRefs } from '@vue/reactivity'
import { watch }  from '../watch'
import { onUnmounted } from '../wechat'
import { useState } from './core'

type Service<D, P extends any[]> = (...args: P) => Promise<D>

interface RequestOptions<T, P> {
  immediate?: boolean
  defaultParams?: P
  mutate?: (data?: T | ((oldData?: T) => T | undefined), disableRequest?: boolean) => void
  onBefore?: (param: P) => void
  onSuccess?: (data: T, param: P) => void
  onError?: (e: Error, param: P) => void
  onFinally?: (param: P, data?: T, e?: Error) => void
  loadingDelay?: number
  cacheKey?: string
  cacheTime?: number
  refreshDeps?: Array<any>
  ready?: Ref<boolean>
  pollingInterval?: number
  pollingWhenHidden?: boolean
}

type RequestState<D, P extends Array<any>> = {
  loading: boolean
  params?: P
  data?: D
  error?: Error
}

interface RequestActions<D, P extends Array<any>> {
  cancel: () => void
  refresh: () => void
  refreshAsync: () => Promise<D>
  run: (...param: P) => void
  runAsync: (...param: P) => Promise<D>
  mutate: (data: D) => void
}

interface RequestCore<D, P extends any[]> extends RequestActions<D, P> {
  state: RequestState<D, P>
  use: (plugins: Array<Partial<PluginResult<D, P>>>) => void
}

type RequestResult<D, P extends any[]> = RequestActions<D, P> &
  {
    [prop in keyof RequestState<D, P>]: Ref<RequestState<D, P>[prop]>
  }

interface PluginResult<D = any, P extends any[] = any> {
  before: (params: P) =>
    | ({
        stopNow?: boolean
        returnNow?: boolean
      } & Partial<RequestState<D, P>>)
    | void

  request: (service: Service<D, P>, params: P) => { service?: Promise<D> }

  success: (data: D, params: P) => void
  error: (e: Error, params: P) => void
  finally: (params: P, data?: D, e?: Error) => void
  cancel: () => void
  mutate: (data: D) => void
}

interface Plugin<D, P extends Array<any>> {
  (requestInstance: RequestCore<D, P>, options: RequestOptions<D, P>): Partial<PluginResult<D, P>>
}

type PickMethod<M, C> = {
  [P in keyof C]: P extends M ? C[P] : never
}[keyof C]

const useRequestCore = <D, P extends Array<any>>(service: Service<D, P>, options: RequestOptions<D, P> = {}) => {
  const [state, setState] = useState<RequestState<D, P>>({
    loading: false,
    params: undefined,
    data: undefined,
    error: undefined,
  })

  const plugins: Array<Partial<PluginResult<D, P>>> = []

  state.params = options.defaultParams as P

  let canceled = false

  const emit = <T extends keyof PluginResult>(
    type: T,
    ...rest: Parameters<PickMethod<T, PluginResult>>
  ): ReturnType<PickMethod<T, PluginResult>> => {
    // @ts-expect-error: Unreachable code error
    return { ...plugins.map((i) => i[type]?.(...rest)).filter(Boolean) }
  }

  const runAsync = async (...params: P) => {
    //params.value = args
    canceled = false
    const { returnNow, ...newState } = emit('before', params) || {}
    setState({
      loading: true,
      params,
      ...newState,
    })
    if (returnNow) {
      return Promise.resolve(state.data)
    }
    options.onBefore?.(params)

    try {
      let { service: servicePromise } = emit('request', service, params)
      if (!servicePromise) {
        servicePromise = service(...params)
      }

      const res = await servicePromise

      if (canceled) {
        return new Promise(() => {})
      }

      setState({
        data: res,
        error: undefined,
        loading: false,
      })

      options.onSuccess?.(res, params)
      emit('success', res, params)
      options.onFinally?.(params, res)
      emit('finally', res, params)
      return res
    } catch (error: any) {
      if (canceled) {
        return new Promise(() => {})
      }

      setState({
        error,
        loading: false,
      })

      options.onError?.(error, params)
      emit('error', error, params)

      options.onFinally?.(params, undefined, error)
      emit('finally', params, undefined, error)

      throw error
    }
  }

  const run = (...args: P) => {
    runAsync(...args).catch((e) => {
      if (!options.onError) {
        console.error(e)
      }
    })
  }

  const mutate = (data: D) => {
    emit('mutate', data)
    state.data = data
  }

  const cancel = () => {
    canceled = true
    state.loading = false
    emit('cancel')
  }

  const use = (usePlugins: Array<Partial<PluginResult<D, P>>>) => {
    plugins.push(...usePlugins)
  }

  const refresh = () => {
    // @ts-expect-error: Unreachable code error
    run(...(state.params || []))
  }

  const refreshAsync = () => {
    // @ts-expect-error: Unreachable code error
    return runAsync(...(state.params || []))
  }

  onUnmounted(cancel)

  return {
    state,
    use,
    run,
    mutate,
    cancel,
    refresh,
    runAsync,
    refreshAsync,
  }
}

export const useRequest = <D, P extends Array<any> = Array<any>>(
  service: Service<D, P>,
  options: RequestOptions<D, P> = {},
  plugins?: Array<Plugin<D, P>>,
): RequestResult<D, P> => {
  const pluginsFactory = [...(plugins || []), useDelay, usePolling, useAuto] as Array<Plugin<D, P>>

  const requestInstance = useRequestCore<D, P>(service, options)

  requestInstance.use(pluginsFactory.map((plugin) => plugin(requestInstance, options)))

  const { loading, data, error, params } = toRefs(requestInstance.state)

  return {
    loading,
    error,
    data: data as Ref<D>,
    params: params as Ref<P>,
    run: requestInstance.run,
    runAsync: requestInstance.runAsync,
    mutate: requestInstance.mutate,
    cancel: requestInstance.cancel,
    refresh: requestInstance.refresh,
    refreshAsync: requestInstance.refreshAsync,
  }
}

const usePolling: Plugin<any, Array<any>> = (request, { pollingInterval }) => {
  if (!pollingInterval) return {}

  let timer: number
  const stop = () => {
    if (timer) {
      clearTimeout(timer)
    }
  }

  return {
    before() {
      stop()
    },
    finally() {
      timer = setTimeout(request.refresh, pollingInterval)
    },
    cancel() {
      stop()
    },
  }
}

const useDelay: Plugin<any, Array<any>> = (request, { loadingDelay = 0 }) => {
  if (!loadingDelay) return {}

  let timer: number 

  const clear = () => {
    if (timer) {
      clearTimeout(timer)
    }
  }

  return {
    before() {
      clear()

      timer = setTimeout(() => {
        request.state.loading = true
      }, loadingDelay)

      return {
        loading: false,
      }
    },
    finally() {
      clear()
    },
    cancel() {
      clear()
    },
  }
}

const useAuto: Plugin<any, Array<any>> = (request, { ready = ref(true), immediate = false, refreshDeps = [] }) => {
  if (refreshDeps) {
    watch(refreshDeps, () => {
      request.refresh()
    })
  }

  if (immediate) {
    if (ready.value) request.refresh()
    else {
      watch(ready, (nv:any) => {
        if (nv) request.refresh()
      })
    }
  }

  return {
    before() {
      if (!ready || !ready.value) {
        return {
          stopNow: true,
        }
      }
    },
  }
}

interface PaginationResult<D, P extends Array<any>> {
  loading: Ref<boolean>
  data: Ref<D>
  run: (...param: P) => void
  refresh: (...param: P) => void
  runAsync: (...param: P) => Promise<D>
  pagination: Pagination
  setPagination: (pag: Pagination) => void
}

type PaginationOptions<D, P> = RequestOptions<D, P> & {
  currentKey: string
  pageSizeKey: string
  totalKey: string
}

const defaultPaginationOptions = {
  currentKey: 'pageNum',
  pageSizeKey: 'pageSize',
  totalKey: 'total',
}
type Pagination = {
  current: number //current page number
  pageSize: number //number of data items per page
  total?: number //total number of data items
}
export function usePagination<D, P extends Array<any> = Array<any>>(
  service: Service<D, P>,
  defaultOptions: Partial<PaginationOptions<D, P>> & RequestOptions<D, P>,
): PaginationResult<D, P> {
  const options: PaginationOptions<D, P> = Object.assign(defaultOptions, defaultPaginationOptions)
  const pagination: Pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
  })

  const pluginsFactory = [useAuto] as unknown as Array<Plugin<D, P>>

  const requestInstance = useRequestCore<D, P>(service, {
    ...options,
    onSuccess(data, params) {
      console.log(params)
      if (params[0]?.[options.currentKey]) {
        pagination.current = params[0][options.currentKey]
      }
      if (params[0]?.[options.pageSizeKey]) {
        pagination.pageSize = params[0][options.pageSizeKey]
      }
      pagination.total = (data as any)[options.totalKey]

      console.log('pagination', params, pagination)
    },
  })

  requestInstance.use(pluginsFactory.map((plugin) => plugin(requestInstance, options)))

  const { loading, data, params } = toRefs(requestInstance.state)

  const runCore = async (args: P, pag?: Pagination) => {
    if (pag) {
      if (typeof args[0] == 'object') {
        if (args[0][options.currentKey]) {
          args[0][options.currentKey] = pag.current
        }
        if (args[0][options.pageSizeKey]) {
          args[0][options.pageSizeKey] = pag.pageSize
        }
      } else {
        args[0] = {
          [options.currentKey]: pag.current,
          [options.pageSizeKey]: pag.pageSize,
        }
      }
    }

    return await requestInstance.runAsync(...args)
  }

  const runAsync = (...args: P) => runCore(args)

  const run = (...args: P) => {
    runCore(args).catch((e) => {
      if (!options.onError) {
        console.error(e)
      }
    })
  }

  const setPagination = (pag: Pagination) => {
    runCore(params?.value, pag).catch((e) => {
      if (!options.onError) {
        console.error(e)
      }
    })
  }

  return {
    loading,
    data: data as Ref<D>,
    run,
    runAsync,
    refresh: requestInstance.refresh,
    pagination,
    setPagination,
  }
}
