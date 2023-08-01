
type IValidateResult = {
  errors: Array<string>,
  fields: Record<string, any>
}

interface IValidator {
  (val: any, rule: IRuleItem, cb?: (res?: Error) => void): boolean | undefined | Error | Promise<any>
}

type IValidatorResult = boolean | undefined | Error | string

type IRuleItem = {
  type?: string,
  required?: boolean,
  len?: number,
  min?: number,
  max?: number,
  enum?: Array<any>,
  pattern?: RegExp,
  message?: string,
  validator?: IValidator
}

type IDescriptor = string | IValidator | IRuleItem

const isError = (obj: any) => (Object.prototype.toString.call(obj) === `[object Error]`)

const compose = (key: string, rules: Array<IRuleItem>) => (val: any) => {
  return Promise.all(rules.map((rule: IRuleItem) => validateRule(rule, val)).flat()).then((resp: Array<IValidatorResult>) => {
    const reasons = resp.filter(i => (i !== true && i !== undefined)).map(i => {
      if (i === false) return ''
      else if (typeof i == 'string') return i
      else if (isError(i)) return (<Error>i).message
    })
    return Promise.resolve([key, reasons])
  })
}

export const useValidate = <U extends Record<string, any>>(descriptor: Record<string, IDescriptor | Array<IDescriptor>>, dataModel?: U, callback?: (...args: Array<any>) => void) => {
  const rules: Array<[string, any]> = []
  for (let key of Object.keys(descriptor)) {
    let content: Array<IDescriptor>
    if (Array.isArray(descriptor[key])) {
      content = <Array<IDescriptor>>descriptor[key]
    } else {
      content = [<IDescriptor>descriptor[key]]
    }

    let newRules: Array<IRuleItem> = content.map((rule: IDescriptor): IRuleItem => {
      if (typeof rule == 'string') {
        return { required: true, message: rule }
      } else if (typeof rule == 'function') {
        return { validator: rule }
      } else {
        return <IRuleItem>rule
      }
    })

    rules.push([key, compose(key, newRules)])
  }

  return (data: U = dataModel || {} as U) => {
    const tasks = rules.map(([key, process]) => process(data[key]))

    return Promise.all(tasks).then(resp => {
      let errors = resp.reduce((t, c) => t.concat(c[1]), [])

      if (errors.length == 0) {
        callback && callback()
        return Promise.resolve()
      } else {
        let fields = resp.reduce((t, c) => {
          t[c[0]] = c[1]
          return t
        }, {})

        callback && callback(errors, fields)
        return Promise.reject({ errors, fields })
      }
    })
  }
}

const validateRule = (rule: IRuleItem, val: any): Array<Promise<IValidatorResult>> => {
  let { type, required, message, validator, len, min, max, pattern } = rule

  let validators: Array<IValidator> = []
  if (required) {
    validators.push(emptyValidator(message))
  }
  if (type == 'idcard' || type == 'id') validators.push(idNumberValidator('', message))
  else if (type == 'phone') validators.push(phoneValidator('', message))
  else if (type == 'mobile') validators.push(mobileValidator('', message))
  else if (type == 'date') validators.push(dateValidator('', message))

  if (len !== undefined || min !== undefined || max !== undefined) validators.push(lengthValidator())

  if (validator !== undefined) {
    validators.push(validator)
  }

  return validators.map(validator => Promise.resolve(validator(val, rule)))
}

const create = (e: string, f: string, handler: (val: any) => IValidatorResult) => (empty = e, format = f): IValidator => (value: any, rule: IRuleItem) => {
  if (value === '' || value === null || value === undefined) {
    if (rule.required) return new Error(empty)
    else return true
  } else {
    if (
      handler(value)
    ) {
      return true
    } else {
      return new Error(format)
    }
  }
}

export const idNumberValidator = create("请输入身份证号", "请输入有效的身份证号", (value) => (/^[1-9]\d{5}(18|19|([23]\d))\d{2}((0[1-9])|(10|11|12))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/.test(value)))

export const phoneValidator = create("请输入电话号码", "请输入正确格式的电话号码", (value) => {
  return (
    /^(\(\d{3,4}\)|\d{3,4}-|\s)?\d{7,14}$/.test(value) ||
    /^1[3-9]\d{9}$/.test(value)
  )
})

export const dateValidator = create("请输入日期", "请输入有效日期", (value: string) => {
  return /^((([0-9]{2})(0[48]|[2468][048]|[13579][26]))|((0[48]|[2468][048]|[13579][26])00)-02-29)|([0-9]{3}[1-9]|[0-9]{2}[1-9][0-9]{1}|[0-9]{1}[1-9][0-9]{2}|[1-9][0-9]{3})-(((0[13578]|1[02])-(0[1-9]|[12][0-9]|3[01]))|((0[469]|11)-(0[1-9]|[12][0-9]|30))|(02-(0[1-9]|[1][0-9]|2[0-8])))$/.test(value)
})

export const mobileValidator = create("请输入手机号码", "请输入正确格式的手机号码", (value) => /^1[3-9]\d{9}$/.test(value))

export const emptyValidator = (empty = "此项不能为空"): IValidator => (value: any, rule: IRuleItem) => {
  let { type, required } = rule

  if (required) {
    if (type == 'string' || type == 'number') {
      if (value === '' || value === null || value === undefined) {
        return new Error(empty)
      }
    } else if (type == 'array' && !(value?.length > 0)) {
      return new Error(empty)
    } else {
      if (!value) {
        return new Error(empty);
      }
    }
  }
}

export const lengthValidator = (): IValidator => (value: any, rule: IRuleItem) => {
  let { len, min, max, message } = rule
  let size = 0
  if (typeof value == 'string' || Array.isArray(value)) {
    size = value.length
  } else {

  }

  if (len !== undefined) {
    if (len !== size) return new Error(message)
  } else if (min !== undefined) {
    if (size < min) return new Error(message)
  } else if (max !== undefined) {
    if (size > max) return new Error(message)
  }

}


export const bankCardValidator = create("请输入银行卡号", "请输入正确格式的银行卡号", (value) => {
  return /^([1-9]{1})(\d{14}|\d{18})$/.test(value)
})