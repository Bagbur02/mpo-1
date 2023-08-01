import { reactive } from "@vue/reactivity"
import { wechatFormer } from './useWeapp'
import { watch } from '../watch'

type PropConstructor<T = any> =
  | {
      new (...args: any[]): T & Record<string, any>
    }
  | {
      (): T
    }
  | PropMethod<T>

type PropMethod<T, TConstructor = any> = [T] extends [((...args: any) => any) | undefined]
  ? {
      new (): TConstructor
      (): T
      readonly prototype: TConstructor
    }
  : never

type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

type DefaultFactory<T> = (props: Record<string, unknown>) => T | null | undefined

type PropOption<T, A> = {
  type?: PropType<T>
  value?: T extends any ? T : DefaultFactory<T>
  rules?: Array<any>
  hidden?: boolean | CallFunction<A>
  disabled?: boolean | CallFunction<A>
  onChange?: CallFunction<A>
  [key: string]: any
}

interface CallFunction<A> {
  (options: { formData: FormPropsValue<A>; ruleData: FormPropsRule<A>; props: FormProps<A>; [key: string]: any }): any
}

type Prop<T, A> = PropOption<T, A> | PropType<T>

export type FormProps<P = Record<string, unknown>> = {
  [K in keyof P]: Prop<P[K], P>
}

export type FormPropsValue<T> = {
  [K in keyof T]: T[K]
}

export type FormPropsRule<T> = {
  [key in keyof T]?: Array<any>
}

export type FormKey<T> = keyof T

type FormOptions<T> = {
  defaultValue?: Record<string, any> | ((...rest: Array<any>) => Promise<Record<string, any>>)
  onChange?: (formData: Partial<FormPropsValue<T>>) => void

  //渲染器
  renderer?: CallFunction<T>

  former?: CallFunction<T>
}

export const useForm = <T extends Record<string, unknown>>(props: FormProps<T>, options: FormOptions<T> = {}) => {
  const ruleData: any = reactive({})
  const formData: any = reactive({})
  const rawData:any = {}
  for (const [key, value] of Object.entries(props)) {
    if (value.rules) {
      ruleData[key] = value.rules
    }
    formData[key] = value.value
  }

  const setInitialData = (res: Record<string, any>) => {
    for (const key of Object.keys(formData)) {
      if (key in res) {
        ;(formData as any)[key] = res[key]
        rawData[key] = res[key]
      }
    }
  }

  if (options.defaultValue) {
    if (typeof options.defaultValue == 'function') {
      options.defaultValue().then(setInitialData)
    } else if (typeof options.defaultValue == 'object') {
      setInitialData(options.defaultValue)
    }
  }

  const former = options.former?.({ formData, ruleData, props }) || wechatFormer({ formData, ruleData, props })

  const render = () => options.renderer?.({ formData, ruleData, props })

  const resetFields = () => former?.resetFields() || setInitialData(rawData)

  const validate = () => former?.validate?.()


  // const validateInfos = () => {
  //   return former?.validateInfos || {}
  // }

  if (options.onChange) {
    watch(formData, options.onChange)
  }
  return {
    render,
    ruleData: ruleData as FormPropsRule<T>,
    formData: formData as FormPropsValue<T>,
    resetFields,
    validate,
    setField:former?.setField
    // validateInfos,
  }
}