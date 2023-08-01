import { ref, Ref, reactive } from '@vue/reactivity'

interface RequestOptions<T, P> {
  immediate?: boolean
  chunk?: boolean
  isNoMore?: (data?: T) => boolean
  onSuccess?: (data: T) => void
  onError?: (e: Error) => void
}

interface actions<T> {
  data: T
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  reloading: Ref<boolean>
  noMore: Ref<boolean>
  loadMore: () => void
  reload: () => void
  load: () => void
  cancel: () => void
  mutate: (data: T) => void
}

const cancelable = <T>(origin: Promise<T>) => {
  let handler: (args: any) => void
  Promise.race([origin, new Promise((resolve, reject) => {
    handler = resolve
  })])
  return () => handler?.({})
}

export const useScroll = <T extends { list: any[], [key: string]: any }, P extends Array<any>>(service: (args?: T) => Promise<T>, options: RequestOptions<T, P> = {}): actions<T> => {
  const loading = ref(false)
  const loadingMore = ref(false)
  const reloading = ref(false)
  const noMore = ref(false)
  const data = reactive<T>({ list: [] } as unknown as T)
  let cancelTask: () => void

  const mutate = (res: T) => {
    Object.keys(res).forEach(i => {
      if (i == 'list') {
        if (options.chunk === true) {
          data.list = [res.list]
        } else {
          data.list = [...res.list]
        }
      }
      else Reflect.set(data, i, res[i])
    })
  }

  const run =  () => {
    const task = service(data).then((res: T) => {
      options.onSuccess?.(res)
      mutate(res)
      if (options.isNoMore?.(data) === true) {
        noMore.value = true
      }
    }).catch((e: Error) => {
      if (!options.onError) {
        throw e
      } else {
        options.onError(e)
      }
    })

    cancelTask = cancelable(task)

    return task
  }

  const loadMore = () => {
    if (options.isNoMore?.(data) === true) {
      noMore.value = true
      return
    }

    loadingMore.value = true

    run().finally(() => {
      loadingMore.value = false
    })
  }

  const load = () => {
    noMore.value = false
    loading.value = true
    run().finally(() => {
      loading.value = false
    })
  }

  const reload = () => {
    noMore.value = false
    reloading.value = true
    run().finally(() => {
      reloading.value = false
    })
  }

  const cancel = () => cancelTask?.()

  if (options?.immediate === true) {
    reload()
  }

  return {
    data, noMore, cancel,
    load, loading,
    loadMore, loadingMore,
    reload, reloading, mutate
  }
}