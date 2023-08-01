type PropType<T = any> =
  | {
      new (...args: any[]): T & Record<string, any>
    }
  | {
      (): T
    }

type ReqResponse = WechatMiniprogram.RequestSuccessCallbackResult

type ReqError<T = any> = WechatMiniprogram.Err

type ReqOption = WechatMiniprogram.RequestOption

type PropsValue<T> = {
  [K in keyof T]: T[K]
} & {
  method: Method
  url: string
  contentType?: 'formdata' | 'json' | 'stream'
  responseType: 'text' | 'arraybuffer'
  redirect?: boolean
}

type ApiItemProps<P = Record<string, unknown>> = {
  [K in keyof P]: PropType<P[K]>
}

export type APICall = <M>(...rest: Array<any>) => Promise<DefaultReqResponse<M>>

export type DefaultReqResponse<T = any> = {
  // error?: { code: number; message?: string; scope?: Record<string, any> }
  code?: number
  data?: T
  message?:string
}

export type PaginationData<T = any> = {
  list: Array<T>
  total: number,
  nextPage?:any
}

interface APIOptions<T,U extends Record<string, unknown>> extends Omit<ReqOption, 'url'> {
  baseURL?: string
  onReq?: (d: Record<string, any>, a: PropsValue<U>) => void
  onRes?: (d: ReqResponse, a: PropsValue<U>) => any
  onError?: (e: ReqError<T>, a: PropsValue<U>) => void
  args?:ApiItemProps<U>
}
// const qs = (d: Record<string, string>) => Object.keys(d).map(i => `${i}=${encodeURI(d[i])}`).join('&')

const urlReplace = (url: string, params: Record<string, any>) =>
  url.replace(/(?:\:)([\w\$]+)/g, ($0, $1) => {
    if ($1 in params) {
      return params[$1]
    } else {
      return ''
    }
  })

type Method = 'GET' | 'OPTIONS' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'TRACE' | 'CONNECT' | undefined


const snakeToUpper = (v: string) => v.replace(/\-([a-z])/g, (_, $1) => $1.toUpperCase())

const transformer = (key: string, val: string, options:Record<string,any>) => {
  if(options[key]){
    if( options[key] === Boolean ){
      return true
    }else if( options[key] === String ){
      return val
    }else if( Array.isArray(options[key]) && options[key].includes(val)){
      return val
    }
  }
  return val
}

const parseLine = (args: string, options:any): Record<string,any> => {
  return args
    .split('--')
    .slice(1)
    .reduce((t: any, i: any) => {
      const [rawKey, ...rest] = i.split(/\s+/)
      const value = rest.join(' ')
      const key = snakeToUpper(rawKey)
      t[key] = transformer(key, value, options)
      return t
    }, {})
}

const parseApiItem = (reqUrl: string,options:any) => {
  let item: any = {}
  const [method, url, ...rest] = reqUrl.split(/\s/)

  if (method) {
    item.method = method as Method
  }
  if (url) {
    item.url = url
  }
  if (rest.length) {
    item = Object.assign(item, parseLine(rest.join(' '),options))
  }
  return item
}

export const createApi = <T,U extends Record<string,unknown>>(apis: T, options: APIOptions<DefaultReqResponse,U> = {}): Record<keyof T, APICall> => {
  const apiMap: any = {}

  for (const [name, url] of Object.entries(apis as Record<string, any>)) {
    apiMap[name] = createRequest<DefaultReqResponse,U>(parseApiItem(url,options?.args || {}),options)
  }
  return apiMap
}

function createRequest<D,U extends Record<string, unknown>>(api: PropsValue<U>, defaultOptions?: APIOptions<D,U>) {
  const { onReq, onRes, onError, ...reqConfig } = defaultOptions || {}
  return (...args: Array<any>) => {
    let vars: Record<string, any> = {
      $r: Math.random(),
      $t: Date.now(),
    }

    if (typeof args[0] == 'object') {
      vars = { ...vars, ...args[0] }
    }

    args.forEach((key, idx) => {
      vars['$' + (idx + 1)] = key
    })

    const contentType = api.contentType || 'json'

    const params: ReqOption = {
      url: defaultOptions?.baseURL + urlReplace(api.url as string || '', vars),
      method: api.method as any || 'GET',
      data: typeof args[0] == 'object' ? args[0] : {},
      ...reqConfig,
    }
    if (!params.header) {
      params.header = {}
    }

    if (contentType == 'formdata') {
      params.header['content-type'] = 'multipart/form-data'
      params.data = params.data
    } else if (contentType == 'stream') {
      params.header['content-type'] = 'application/octet-stream'
      // params.data = params.data.stream
    } else {
      params.header['content-type'] = 'application/json'
    }

    onReq?.(params, api)

    return new Promise((resolve, reject) => {
      wx.request({
        ...params,
        success(res) {
          if (onRes) {
            resolve(onRes?.(res, api) || res.data)
          } else {
            resolve(res.data)
          }
        },
        fail(e) {
          reject(onError?.(e,api) || e)
        },
      })
    })
  }
}

export const useCall = (fn: APICall) => fn().then((res) => res.data)
