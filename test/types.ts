import { defineComponent, definePage, createApp, onShow, onError, onTabItemTap, ref, PropType,useForm ,useEventTarget, createApi } from "../src";

createApp({
  
  setup(props, ctx) {
    onShow((res) => {
      console.log(res)
    })

    onError((e) => {

    })
  }
})

type Custom = {
  a: number,
  b: string
}

defineComponent({
  props: {
    a: String,
    b: {
      type: String,
    },
    b1: {
      type: Number,
      value: 1,
    },
    c: {
      type: Symbol,
      value: Symbol('symbol')
    },
    d: {
      type: Array,
      value: ['a', 1]
    },
    e: {
      type: Function,
      value: () => 2,
    },
    f: {
      type: Object,
      value: {
        a: 1
      },
      extra: ''
    },
    f1: {
      type: Object,
      value: { a: 1 }
    },
    g: {
      type: Date,
      value: new Date()
    },
    h: {
      type: Object as PropType<Custom>,
      value: { a: 1, b: '2' },
      extra: ''
    }
  },
  setup(props, ctx) {
    let a = props.a
    let b = props.b
    let b1 = props.b1
    let c = props.c
    let d = props.d
    let e = props.e
    let f = props.f
    let g = props.g
    let h = props.h

    let val = ref(0)


    setInterval(() => {
      val.value++
    }, 1000)
  },
})



definePage((props, ctx) => {
  onTabItemTap((res) => {

  })

  return {

  }
}, {
  onPageScroll: true,
})


const { formData, validate } = useForm({
  name:{
    valueType:String,
    rules:[
      { required:true , min: 2 , message:'长度不小于2'}
    ]
  },
  age:{
    value:1
  }
})

formData.name = '1'
formData.age = 2


const api = createApi({
  signin: 'POST /account/signin --bare --save-token',
  profile: 'GET /account/profile?t=:$t',
},{
  args:{
    bare:String
  },
  onRes(d,options){
    options.contentType
    options.bare
    options.contentType
    // if(options.bare)
  }
})

