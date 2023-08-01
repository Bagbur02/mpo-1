import { ref } from '@vue/reactivity'
import { delayToggle } from './core'
import { watch } from 'watch'
import { useValidate } from './useValidate'

const useToastState = ref(0)
export const useLoading = (watcher: any, title: string = '', delay: number = 0) => {
  const actions = delayToggle(() => delay, () => {
    useToastState.value = 1;
    wx.showLoading({ title })
  }, () => {
    if (useToastState.value == 1) {
      useToastState.value = 0;
      wx.hideLoading({ fail() { } })
    }
  })
  watch(watcher, (nv: any) => {
    if (nv) actions.true()
    else actions.false()
  }, { immediate: true })
}

export const wechatFormer = ({ruleData,formData,props}:any) => {
  const validator = useValidate(ruleData)
  const setField = (e:any) => {
   
    // copy 
    let key = e.currentTarget.dataset.field
    let value = e.detail.value
    let isNumber = props[key].type == Number
    
    let nv = isNumber ? +value : value
    if(formData[key] !== nv ){
      formData[key] = nv
    }
  }


  return {
    validate: () => validator(formData),
    setField
  }
}