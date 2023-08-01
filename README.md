# mpo

Develop mini program by vue

## Useage

```js
import { defineCompont, ref, useForm, useLoading, useRequest, useScroll } from "mpo";

const apis = {
  get: (id) => Promise.resovle({ id, name: "name", age: 15 }),
  save: (data, time = 500) =>
    new Promise((resolve) => {
      console.log("save", data);
      setTimeout(() => resolve(data), time);
    }),
};

defineComponent({
  props: {
    defaultId: {
      type: Number,
      value: 1,
    },
  },
  setup(props, ctx) {
    const { formData, setField, validate, resetFields } = useForm(
      {
        id: {
          valueType: Number,
        },
        name: {
          valueType: String,
          rules: [{ min: 5, message: "不少于5个字符" }],
        },
        age: {
          valueType: Number,
        },
        gender: {
          value: 1,
        },
      },
      {
        defaultValue: () => api.get(defaultId),
      }
    );

    const increase = () => formData.age++;

    const { run, loading } = useRequest(api.save);

    const save = async () => {
      try {
        await validate();
        await run(formData);
      } catch (e) {
        wx.showToast(e.errors);
        console.log(e);
      }
    };


    cosnt { loadMore } = useScroll()

    return {
      formData,
      count,
      increase,
      resetFields,
    };
  },
});
```

```wxml
<input value="{{formData.name}}" data-prop="name" bind:change={setField} placeholder="name" />
<input value="{{formData.age}}" data-prop="age" bind:change={setField} placeholder="age" />
<button bind:tap="save">save</button>
<button bind:tap="resetFields">reset</button>
<button bind:tap="increase">increase</button>
<view>{{count}}</view>
```
