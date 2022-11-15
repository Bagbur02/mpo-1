import { defineComponent, definePage, createApp, onShow, onError, onTabItemTap, ref, PropType } from "../src";

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
      value: '1',
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


defineComponent((props, ctx) => {
  return {

  }
})


definePage((props, ctx) => {
  onTabItemTap((res) => {

  })

  return {

  }
}, {
  onPageScroll: true,
})