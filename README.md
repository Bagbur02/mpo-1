# mpo

Develop mini program by vue

## Useage
```js
import { defineCompont, ref } from "mpo"

defineComponent({
  props: {
    prop1: {
      type: Number,
      value: 1
    }
  },
  setup(props, ctx) {
    let count = ref(props.defaultValue)

    const increase = () => val.value++

    return {
      val, increase
    }
  },
})

```

```wxml
<button bind:tap="increase">increase</button>
<view>{{val}}</view>
```