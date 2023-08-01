

import { isRef, isReactive, reactive, shallowReadonly, shallowReactive, effectScope, UnwrapRef } from '@vue/reactivity'

import { watch } from './watch'

const EFFECT_SCOPE = Symbol('effect_scope')

const PROPS = Symbol('props')

const BINDINGS = Symbol('bindings')

const CONTEXT_METHODS = ['createSelectorQuery', 'createIntersectionObserver', 'selectComponent', 'selectAllComponents', 'getTabBar', 'getPageId', 'animate', 'clearAnimation', 'getOpenerEventChannel', 'setData', 'hasBehavior', 'triggerEvent', 'selectOwnerComponent', 'getRelationNodes', 'groupSetData']

export enum TargetType {
  'APP' = 1,
  'PAGE' = 2,
  'COMPONENT' = 3,
  'NULL' = 0
}

type PropOption<T = any> = {
  type: PropType
  value?: PropValue<T>
  [key: string]: any
}

type PropValue<P> = P extends { type: infer T, value?: infer V, [key: string]: any } ? Instance<T, V> : never

export type PropType<T = any> = {
  (...args: any[]): T | undefined
}

type Instance<T, V = any> =
  T extends DateConstructor ? Date :
  T extends ArrayConstructor ? V :
  T extends ObjectConstructor ? (V extends object ? V : object) :
  // T extends FunctionConstructor ? (V extends { (...args: any[]): any } ? V : { (...args: any[]): any }) :
  // basic constructor: Number/Boolean/String/Symbol/ () => type
  T extends { (...args: any[]): infer D } ? D :
  T

type PropDefineKey<T> =
  T extends PropType ? T :
  T extends { type: PropType, [key: string]: any } ? PropOption<T> :
  never

type PropDefine<T> = {
  [key in keyof T]: PropDefineKey<T[key]>
}

type PropGetKey<T = any> =
  T extends PropType ? Instance<T> :
  T extends { type: PropType, [key: string]: any } ? PropValue<T> :
  never

type PropGet<T extends any> = {
  [K in keyof T]: PropGetKey<T[K]>
}


interface Setup<T, C> {
  (props: Readonly<PropGet<T>>, ctx: C): any
}

interface AppOptions<T extends Record<string, any>, C> {
  setup: Setup<T, C>,
  props?: PropDefine<T>,
  [key: string]: any,
  [BINDINGS]?: any,
  [EFFECT_SCOPE]?: any,
  [PROPS]?: Record<string, any>
}

type InitConfig = {
  onPageScroll?: boolean
  onShareAppMessage?: boolean
  onShareTimeline?: boolean,
  watchProp?: boolean
}

type IEvent<T> = (args: T) => any

interface AppContext {
  app: any
}

interface PageContext extends WechatMiniprogram.Page.InstanceProperties, WechatMiniprogram.Page.InstanceMethods<Record<string, any>> {
  app: any
}

interface ComponentContext extends WechatMiniprogram.Component.InstanceProperties, WechatMiniprogram.Component.InstanceMethods<Record<string, any>> {
  app: any
}

const globalTarget: ({ bindings: any, type: TargetType }) = { bindings: null, type: TargetType.NULL }

type ILifecycleType = [needCheck: boolean, eventName: string, eventScope?: string]

const lifecycleTypes: Partial<Record<TargetType, Array<ILifecycleType>>> = {}

/**
 * 绑定生命周期，将储存在 this[BINDINGS] 中,生命周期的调用配置到options中
 * @param dst 
 * @param type 
 * @returns 
 */
const bindEvent = (options: any, type: TargetType, config?: InitConfig) => {

  const events = lifecycleTypes[type] || []

  //取得当前类型所有的事件
  for (let [needCheck, eventName, scope] of events) {
    //可选事件需从options中确认
    if (needCheck === true && (<any>config)?.[eventName] !== true) {
      continue
    }

    const target: any = scope ? options[scope] ||= {} : options
    const originFn = target[eventName]

    target[eventName] = function (...rest: Array<any>) {
      originFn?.call(this)
      // TODO Components 会出现 只有 created/ready 没有attached 的情况
      // 例如父组件attached时 设置子组件wx:if={{false}}
      return this[BINDINGS]?.[eventName]?.apply(this, rest)
    }
  }
  return options
}

const useEvent = <T>(...lifetimes: Array<string>) => {
  let typeMap: Record<string, TargetType> = { 'a': TargetType.APP, 'p': TargetType.PAGE, 'c': TargetType.COMPONENT }
  const eventsName: Partial<Record<TargetType, string>> = {}
  lifetimes.forEach((i) => {
    let optional = false
    if (i.startsWith('?')) {
      optional = true
      i = i.substring(1)
    }

    let [type, ...rest] = i.split('.')
    let targetType = typeMap[type]
    let [eventName, scope] = rest.reverse()
    lifecycleTypes[targetType] ||= []
    lifecycleTypes[targetType]?.push([optional, eventName, scope])
    eventsName[targetType] = eventName
  })

  return (cb: IEvent<T>) => {

    if (!globalTarget.bindings) throw new Error('It MUST BE used in setup function')

    if (!cb) return

    const { type, bindings } = globalTarget

    const eventName = eventsName[type]

    if (eventName) {
      //处理多次使用事件绑定
      const originFn = bindings[eventName]

      bindings[eventName] = function (res: any) {
        originFn?.call(this)
        return cb(res)
      }
    }

  }
}

const useSetup = (options: any, instance: any) => {
  const originSetData = instance.setData.bind(instance)

  let lastTickUpdate:any = {}
  let lastTickPending:boolean = false
  const nextTickSetData = (key:any,value:any) => {
    lastTickUpdate[key] = value
    if(!lastTickPending) {
      lastTickPending = true
      Promise.resolve().then(() => {
        originSetData(lastTickUpdate)
        lastTickUpdate = {}
        lastTickPending = false
      })
    }
  }

  const rawData: Record<string, any> = {}
  // effectData: any = reactive({})
  const refData: any = {}
  const proxyData: any = {}
  for (let i of Object.keys(options)) {
    let val = options[i]
    if (typeof val == 'function') {
      instance[i as string] = val
    }
    else {
      // if (isRef(val) || isReactive(val)) {
      //   effectData[i] = val
      // } else {
      //   rawData[i] = val
      // }
      if (isRef(val)) {
        refData[i] = val
        rawData[i] = val.value
      } else if (isReactive(val)) {
        proxyData[i] = val
        rawData[i] = val
      } else {
        rawData[i] = val
      }
    }
  }

  //proxy setData method
  instance.setData = function (data: any) {
    const rawData: Record<string, any> = {}
    Object.keys(data).forEach(key => {
      if (refData.hasOwnProperty(key)) {
        refData[key].value = data[key]
      } else if (proxyData.hasOwnProperty(key)) {
        proxyData[key] = data[key]
      } else {
        rawData[key] = data[key]
      }
    })
    originSetData(rawData)
  }


  Object.keys(proxyData).forEach((key: string) => {
    watch(proxyData[key], (nv: any) => {
      // originSetData({ [key]: nv })
      nextTickSetData(key, nv)
    }, { deep: true })
  })
  Object.keys(refData).forEach((key: string) => {
    watch(refData[key], (nv: any) => {
      // originSetData({ [key]: nv })
      nextTickSetData(key, nv)
    }, { deep: true })
  })

  originSetData(rawData)

  globalTarget.bindings = null
  globalTarget.type = TargetType.NULL
}

const createContext = (context: any, methods: Array<string>, props: Record<string, any>) => {
  const ctx: Record<string, any> = props
  methods.forEach(i => {
    ctx[i] = context[i].bind(context)
  })
  return ctx
}

export const createApp = <T extends Record<string, any>>(options: AppOptions<T, any> | Setup<T, AppContext>) => {

  if (typeof options == 'function') {
    options = { setup: options }
  }

  const { setup, ...newOpts } = options

  if (setup) {

    newOpts.onLaunch = function (query: T) {

      globalTarget.bindings = this[BINDINGS] = {}
      globalTarget.type = TargetType.APP
      const scope = this[EFFECT_SCOPE] = effectScope()

      scope.run(() => {
        let options: any = setup?.(shallowReactive(query as any),{}) || {}

        for (let key of Object.keys(options)) {
          let val = options[key]
          this[key as string] = val
        }
      })

      globalTarget.bindings = null
      globalTarget.type = TargetType.NULL
    }
    bindEvent(newOpts, TargetType.APP)
  }
  App(newOpts)
}


export const definePage = <T extends Record<string,any>>(options: AppOptions<T, PageContext> | Setup<T, PageContext>, config?: InitConfig): void => {

  if (typeof options == 'function') {
    options = { setup: options } as AppOptions<T, PageContext>
  }

  const { setup, ...newOpts } = options

  config ||= {}

  if (setup) {
    //const originOnUnload = newOpts.onUnload
    newOpts.onLoad = function (query: any) {
      const ctx = createContext(this, CONTEXT_METHODS, {
        get app() { return getApp() },
        is: this.is,
        route: this.route,
        options: this.options
      }) as PageContext

      globalTarget.bindings = this[BINDINGS] = {}
      globalTarget.type = TargetType.PAGE

      const scope = this[EFFECT_SCOPE] = effectScope()

      scope.run(() => {
        useSetup(setup?.(query, ctx) || {}, this)
      })

      newOpts.$onLoad?.call(this)
    }

    newOpts.onUnload = function () {
      //originOnUnload?.call(this)
      // this[EFFECT_SCOPE].forEach((effect: any) => effect())
      this[EFFECT_SCOPE]?.stop()
    }

    bindEvent(newOpts, TargetType.PAGE, config)
  }

  Page(newOpts)
}

export const defineComponent = <T extends Record<string, any>>(options: AppOptions<T, ComponentContext> | Setup<T, ComponentContext>, config?: InitConfig) => {

  if (typeof options == 'function') {
    options = { setup: options }
  }

  options.methods = {}

  options.lifetimes ||= {}

  options.pageLifetimes ||= {}

  options.options ||= {}

  let { setup, props, ...newOpts } = options

  newOpts.properties = props

  config ||= {}

  if (setup) {

    const props = Object.keys(newOpts.props || newOpts.properties || {})

    const watchProp = config.watchProp !== false

    newOpts.lifetimes.attached = function (query: any) {
      const ctx = createContext(this, CONTEXT_METHODS, {
        get app() { return getApp() },
        is: this.is,
        id: this.id,
        createMapContext: (id: string) => wx.createMapContext(id, this)
      }) as ComponentContext

      let rawProps: any = {}

      for (let prop of props) rawProps[prop] = this.data[prop]

      if (watchProp) this[PROPS] = shallowReactive(rawProps)

      globalTarget.bindings = this[BINDINGS] = {}
      globalTarget.type = TargetType.COMPONENT
      const scope = this[EFFECT_SCOPE] = effectScope()
      scope.run(() => {
        useSetup(setup?.(shallowReadonly((watchProp ? this[PROPS] : rawProps)) as Readonly<PropGet<T>>, ctx) || {}, this)
      })

      //originOnLoad?.call(this)
    }

    newOpts.lifetimes.detached = function () {
      this[EFFECT_SCOPE]?.stop()
    }

    // watch props
    if (watchProp && Object.keys(props).length) {
      newOpts.observers ||= {}
      props.forEach((prop) => {
        const originObserver = newOpts.observers?.[prop]
        newOpts.observers[prop] = function (value: any) {
          if (this[PROPS]) {
            this[PROPS][prop] = value;
          }
          originObserver?.call(this, value);
        };
      });
    }

    bindEvent(newOpts, TargetType.COMPONENT, config)
  }

  newOpts.options.addGlobalClass ||= true

  Component(newOpts)
}

// Component
// export const onMounted = useEvent('c.lifetimes.attached')
export const onUnmounted = useEvent('c.lifetimes.detached')
export const onMoved = useEvent('c.lifetimes.moved')

// Page & Component
export const onReady = useEvent('p.onReady', 'c.lifetimes.ready')
export const onResize = useEvent('p.onResize', 'c.pageLifetimes.resize')
export const onAddToFavorites = useEvent('p.onAddToFavorites', 'c.methods.onAddToFavorites')
export const onShareTimeline = useEvent('?p.onShareTimeline', '?c.methods.onShareTimeline')
export const onShareAppMessage = useEvent('?p.onShareAppMessage', '?c.methods.onShareAppMessage')
export const onPageScroll = useEvent('?p.onPageScroll', '?c.methods.onPageScroll')

// Page
// export const onLoad = useEvent('p.onLoad')
export const onUnload = useEvent<Record<string, string | undefined>>('p.onUnload')
export const onPullDownRefresh = useEvent('p.onPullDownRefresh')
export const onReachBottom = useEvent('p.onReachBottom')
export const onTabItemTap = useEvent<WechatMiniprogram.Page.ITabItemTapOption>('p.onTabItemTap')
export const onSaveExitState = useEvent('p.onSaveExitState')

// App
// export const onLaunch = useEvent('a.onLaunch')
export const onPageNotFound = useEvent<WechatMiniprogram.App.PageNotFoundOption>('a.onPageNotFound')
export const onUnhandledRejection = useEvent('a.onUnhandledRejection')
export const onThemeChange = useEvent('a.onThemeChange')

// App & Component
export const onError = useEvent<string>('a.onError', 'c.lifetimes.error')

// App && Page && Component
export const onShow = useEvent<WechatMiniprogram.App.LaunchShowOption>('a.onShow', 'p.onShow', 'c.pageLifetimes.show')
export const onHide = useEvent('a.onHide', 'p.onHide', 'c.pageLifetimes.hide')

const provides = Object.create(null)

export interface InjectionKey<T> extends Symbol { }

export const provide = <T>(key: InjectionKey<T> | string, value: T): void => {
  provides[key as string] = value
}

export const inject = (
  key: InjectionKey<any> | string | Array<string | InjectionKey<any>>,
  defaultValue?: unknown,
  treatDefaultAsFactory = false
): unknown => {
  if (Array.isArray(key)) {
    return key.map((i: string | InjectionKey<any>) => {
      return provides[i as string]
    })
  }

  if ((key as string | symbol) in provides) {
    return provides[key as string]
  }

  return (treatDefaultAsFactory && typeof defaultValue === 'function') ? (<() => any>defaultValue)() : defaultValue
}