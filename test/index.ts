import { defineComponent, definePage, createApp, onShow, onError, onTabItemTap, ref } from "../src";

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
      type: Number,
      value: 1,
    },
    c: Symbol,
    d: {
      type: Array,
      value: ['a', 1]
    },
    e: {
      type: Function,
      value: function () {

      },
    },
    f: {
      type: Object,
      value: {
        a: 'string',
        b: 1
      },
      extra: ''
    },
    g: {
      type: Date,
      value: new Date()
    },
    h: {
      type: Object,
      value: { a: 1, b: '2' } as Custom,
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
