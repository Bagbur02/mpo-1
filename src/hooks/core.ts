import { reactive, ref, Ref, toRefs } from '@vue/reactivity'

export const useState = <T extends Record<string, any>>(initialState: T = {} as T): [T, (state: T) => T, () => T] => {
  const state = reactive(initialState)
  const setState = (val: T, clear = false) => {
    Object.keys(val).forEach((key) => {
      Reflect.set(state, key, val[key])
    })
    return state as T
  }

  const clearState = () => {
    Object.keys(state).forEach((key) => Reflect.deleteProperty(state, key))
    return state as T
  }

  return [state as T, setState, clearState]
}

export const useStorage = <T>(key: string, defaultValue: T): [Ref<T>, (value?: T) => void] => {
  const data = ref(wx.getStorageSync(key) || defaultValue)
  const setData = (val?: T) => {
    data.value = val
    if (val === undefined) {
      wx.removeStorageSync(key)
    } else {
      wx.setStorageSync(key, val)
    }
  }

  return [data, setData]
}


interface EventTargetOptions<T, U> {
  defaultValue?: T,
  confirm?: Boolean,
  transformer?: (value: U, e: any) => T
}

export interface EventTargetActions<T> {
  onChange: (e: { detail: { value: T } }) => void,
  onConfirm: () => void,
  reset: () => void
}

export const useEventTarget = <T, U>(options: EventTargetOptions<T, U> = {}): [Ref<T>, EventTargetActions<T>] => {
  const data = ref(options.defaultValue as T) as Ref<T>

  let tmpData: T = options.defaultValue as T

  const onChange = (e: { detail: { value: T } }) => {
    tmpData = options.transformer ? <T>options.transformer(e.detail?.value as unknown as U, e) : e.detail.value
    if (options.confirm !== true) {
      data.value = tmpData
    }
  }

  const onConfirm = () => {
    data.value = tmpData
  }

  const reset = () => {
    data.value = options.defaultValue as T
  }

  return [data, { onChange, reset, onConfirm }]
}


export const delayToggle = (getter: () => number | undefined, setLeft: () => any, setRight: () => any) => {
  let handler: any
  return {
    true() {
      let timeout = getter()
      if (getter === undefined || getter() === 0) {
        setLeft()
      } else {
        handler = setTimeout(() => {
          setLeft()
        }, timeout)
      }
    },
    false() {
      if (handler) {
        clearTimeout(handler)
        handler = null
      }
      setRight()
    }
  }
}

export interface ToggleActions<T> {
  setLeft: () => void;
  setRight: () => void;
  set: (value: T) => void;
  toggle: () => void;
}

export const useToggle = <D, R>(defaultValue?: D, reverseValue?: R): [Ref<D | R>, ToggleActions<D | R>] => {
  if (defaultValue === undefined) {
    defaultValue = false as unknown as D
  }

  if (reverseValue === undefined) {
    reverseValue = !Boolean(defaultValue) as unknown as R
  }

  const state = ref(defaultValue) as Ref<D | R>

  const toggle = () => {
    state.value = (state.value === defaultValue ? reverseValue : defaultValue) as D | R
  }

  const set = (value: D | R) => state.value = value

  const setLeft = () => (state.value = defaultValue as D)

  const setRight = () => (state.value = reverseValue as R)

  return [state, { toggle, set, setLeft, setRight }]
}

type UseBooleanAction = [ Ref<Boolean>, { toggle:()=>void, set:(v:boolean) => any , setTrue:()=>void,setFalse:()=>void}]
export const useBoolean = (defaultValue = false):UseBooleanAction => {
  const state: Ref<boolean> = ref(defaultValue)

  const toggle = () => {
    state.value = state.value === true ? false : true
  }

  const setTrue = () => (state.value = true)

  const setFalse = () => (state.value = false)

  const set = (val: boolean) => (state.value = val)

  return [state, { toggle, set, setTrue, setFalse }]
}

export interface DelayApplyActions<T> {
  set: (e: T) => void,
  apply: () => any,
}
export const useDelayApply = <T extends any>(cb:any,options:{ transformer?:any,defaultValue?:T } = {}):[Ref<T | undefined>,DelayApplyActions<T>] => {
  const data = ref(options?.defaultValue) as Ref<T | undefined>

  const apply = () => cb(data.value)

  const set = (val:T) => {
    data.value = options.transformer ? options.transformer(val) : val
  }

  return [data, { set, apply }]
}