import { watch } from "rollup";
import {
  useForm,
  ref,
  watchEffect,
  useRequest,
  useLoading,
  useToggle,
  useScroll,
} from "../dist/index.js";

const sleep = (time) =>
  new Promise((resolve) => setTimeout(() => resolve(), time));

const apis = {
  get: () => Promise.resolve({ name: "name", age: 15 }),
  save: async (data) => {
    await sleep(500);
    return data;
  },
  list: async (params) => {
    let pageSize = params.pageSize || 1;
    let res = {
      list: new Array(10).fill(0).map((i, idx) => `${pageSize}_${idx}`),
    };
    if (pageSize < 10) {
      res.nextPage = pageSize + 1;
    }
    console.log(res);
    await sleep(500);
    return res;
  },
};

const testUseForm = async () => {
  const { formData, validate, resetFields } = useForm(
    {
      name: {
        valueType: String,
        rules: [{ min: 2, message: "长度不小于2" }],
      },
      age: {
        value: 1,
      },
      count: {
        value: 0,
      },
    },
    {
      defaultValue: () => apis.get(),
    }
  );

  watchEffect(() => {
    console.log(formData.age);
    console.log(formData);
  });

  let timer = setInterval(() => {
    if (formData.count >= 5) {
      resetFields();
      clearInterval(timer);
      return;
    }
    formData.count++;
    formData.time = Date.now();
  }, 1000);
  /*
  const { run, loading } = useRequest(() => {
    return api({code:0})
  })
  */
  const submit = async () => {
    try {
      await validate();
      await apis.save(formData);
      // await run()
      /* */
    } catch (e) {
      console.log(e);
    }
  };

  await submit();
};

const testWeapp = () => {
  global.wx = {
    showLoading: function () {
      console.log("loading");
    },
    hideLoading() {
      console.log("hide loading");
    },
  };

  const [loading, { setLeft, setRight }] = useToggle(true, false);

  setTimeout(setRight, 1000);

  useLoading(loading);
};

const testUseScroll = () => {
  console.log("===useScroll===");
  const { loadMore, data } = useScroll(
    (lastData) => apis.list({ pageSize: lastData?.nextPage || 1 }),
    {
      isNoMore: (d) => {
        console.log("is no more", d.nextPage);
        return d?.nextPage === undefined;
      },
      immediate: true,
      onSuccess(res) {
        // console.log(data)
        setTimeout(loadMore, 50);
      },
    }
  );

  watch(
    () => data,
    (nv) => {
      // console.log('scroll data:',nv.length)
      // loadMore()
    },
    { deep: true }
  );
};

testUseScroll();

// let lastTickUpdate = {};
// let lastTickPending = false;
// const originSetData = (v) => {
//   console.log("set", v);
// };
// const nextTickSetData = (key, value) => {
//   lastTickUpdate[key] = value;
//   if (!lastTickPending) {
//     lastTickPending = true;
//     Promise.resolve().then(() => {
//       originSetData(lastTickUpdate);
//       lastTickUpdate = {};
//       lastTickPending = false;
//     });
//   }
// };

// nextTickSetData("a", 1);
// nextTickSetData("b", 2);

// setTimeout(() => {
//   nextTickSetData("ac", 1);
//   nextTickSetData("bc", 2);
// }, 1000);
