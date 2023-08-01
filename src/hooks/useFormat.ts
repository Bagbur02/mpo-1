export const isType = (type: string) => (obj: any) => (Object.prototype.toString.call(obj) === `[object ${type}]`)

export const isArray = isType('Array')

export const isObject = isType('Object')

export const isDate = isType('Date')

export const isString = isType('String')

export const isNumber = isType('Number')

export const isFunction = isType('Function')

export const map = (data: Array<any>, key: string = 'key', value: string) => {
  let obj: Record<string, any> = {}
  data.forEach(i => {
    if (key in i) {
      obj[i[key]] = value ? i[value] : i
    }
  })
  return obj
}

const duration = (v: number): string => {
  let d = Math.floor(v / 86400)
  let h = Math.floor(v / 3600) % 24
  let m = Math.floor(v / 60) % 60

  if (v < 60) {
    return '刚刚'
  } else if (v < 3600) {
    return `${m}分钟前`
  } else if (v < 86400) {
    return `${h}小时前`
  } else {
    return `${d}天前`
  }
}

export const relativeTime = (val: string | Date) => {
  let lastTime
  if (typeof val == 'string') lastTime = new Date(val).getTime()
  else if (isDate(val)) lastTime = val.getTime()

  return lastTime ? duration(Date.now() - lastTime) : ''
}

const zeroize = (v: number) => v < 10 ? `0${v}` : `${v}`;

export const moment = (date: string | Date | number, expr: string) => {
  let a: Date
  if (typeof date === 'string') {
    // ios 2008-12-29T00:27:42GMT-08:00 2008-12-29T00:27:42-0800
    // 不能有毫秒
    //ios 2020-09-04T09:18:10.55+00:00
    a = new Date(date.replace(/\.\d*/, '').replace(/\+(\d\d)(\d\d)$/, '+$1:$2').replace(/Z$/, '+00:00'))
  } else if (isDate(date)) {
    a = date as Date
  } else if (typeof date === 'number') {
    a = new Date(date)
  } else {
    return ''
  }

  if (expr == 'timestamp' || expr == 'ms') return a.getTime()

  if (expr == 'date') return a

  let y = a.getFullYear(),
    M = a.getMonth() + 1,
    d = a.getDate(),
    D = a.getDay(),
    h = a.getHours(),
    m = a.getMinutes(),
    s = a.getSeconds(),
    w = a.getDay();

  return expr.replace(/(?:s{1,2}|w{1,2}|m{1,2}|h{1,2}|d{1,2}|M{1,4}|y{1,4})/g, (str): string => {

    switch (str) {
      case 's':
        return '' + s;
      case 'ss':
        return zeroize(s);
      case 'm':
        return '' + m;
      case 'mm':
        return zeroize(m);
      case 'h':
        return '' + h;
      case 'hh':
        return zeroize(h);
      case 'd':
        return '' + d;
      case 'w':
        return '' + w;
      case 'ww':
        return '' + (w == 0 ? 7 : w);
      case 'dd':
        return zeroize(d);
      case 'M':
        return '' + M;
      case 'MM':
        return zeroize(M);
      case 'MMMM':
        return ['十二', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一'][m] + '月';
      case 'yy':
        return String(y).substr(2);
      case 'yyyy':
        return '' + y;
      default:
        return str.substr(1, str.length - 2);
    }
  })
}

export const now = (expr = 'yyyy-MM-dd hh:mm:ss') => moment(new Date(), expr)
export const datetime = (val: any) => val ? moment(val, 'yyyy-MM-dd hh:mm:ss') : 'n/a'
export const time = (val: any) => moment(val, 'hh:mm:ss')
export const date = (val: any) => val ? moment(val, 'yyyy-MM-dd') : 'n/a'
export const year = (val: any) => (`${val} 年`)
export const privacyPhone = (val:string) => val.slice(0, 3) + '****' + val.slice(7)
export const privacyIdcard = (val:string) => val.slice(0, 6) + '********' + val.slice(14)

type IConvRuleFunction<T> = { (item: T): any }
type IConvRuleArray<T> = Array<[string, string | IConvRuleFunction<T>, string?]>
type IConvRuleObject<T> = Record<string, string | IConvRuleFunction<T>>
type IConvRules<T> = IConvRuleArray<T> | IConvRuleObject<T> | ((inData: T | Array<T>) => T | Array<any>)

const conv = <K extends string, V>(data: Dictionary<K, V>, key: K, val: V, fix: string) => {
  data[key] = val
}

type Dictionary<TKey extends number | string, TValue> = {
  [key in TKey]: TValue
};

//conv({ a: 1 }, 'a', 1)
// conv({ a: 1 }, 'b', 1)

export const useFormat = (dicts: Record<string, Array<any>>, processor:Record<string,any> = {}) => {
  const methods: Record<string, any> = { datetime, time, date, year, privacyPhone, privacyIdcard,...processor }

  const useMap = (i: string) => {
    const dictMap = map(dicts[i], 'value', 'label')
    return (k: string) => dictMap[k]
  }

  const process = <T extends Record<string, any>>(data: T, key: string, label: string | IConvRuleFunction<T>, fix = '') => {
    if (typeof label === 'string') {
      if (methods[label]) {
        (<any>data)[key + fix] = methods[label](data[key])
      }
    } else if (isFunction(label)) {
      (<any>data)[key] = label(data)
    }
  }


  for (let i of Object.keys(dicts)) {
    methods[i] = useMap(i)
  }

  return <T extends Record<string, any>>(data: T | Array<T>, rules: IConvRules<T>, fix: string = 'Text') => {
    if (typeof rules === 'function') {
      return rules(data)
    }

    if (isObject(rules)) {
      rules = Object.keys(rules).map(i => ([i, (<IConvRuleObject<T>>rules)[i]])) as IConvRuleArray<T>
    }

    if (Array.isArray(data)) {
      (<IConvRuleArray<T>>rules).forEach(i => data.forEach(record => process<T>(record, i[0], i[1], i[2] || fix)))
    } else {
      (<IConvRuleArray<T>>rules).forEach(i => process<T>(data, i[0], i[1], i[2] || fix))
    }

    return data
  }
}

export const someday = (expr: string = '', format = 'yyyy-MM-dd') => {
  let now = new Date()
  let ms = now.getTime()
  let date = expr.match(/^\d+\-\d+\-\d+/)?.[0]
  if (date && /^\d+\-\d+\-\d+$/.test(date)) {
    ms = new Date(date).getTime()
    expr = expr.replace(date, '')
  }
  const units = expr.replace(/\s*/g, '').match(/[+-]?\d*(d|h|m|s)/g) || []
  const nums: Record<string, number> = { d: 24 * 60 * 60 * 1000, h: 60 * 60 * 1000, m: 60 * 1000, s: 1000 }

  for (let unit of units) {
    let hit = unit.match(/^([+-]?\d*)(d|h|m|s)$/)
    let v = hit?.[1] ? parseInt(hit[1]) : 0
    let t = hit?.[2] || ''
    if (t) ms += v * nums[t]
  }

  now.setTime(ms);

  return moment(now, format)
}
