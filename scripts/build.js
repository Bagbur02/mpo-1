// const rollup = require('rollup');
// const { terser } = require('rollup-plugin-terser')
// const typescript = require('@rollup/plugin-typescript')
// const { nodeResolve } = require('@rollup/plugin-node-resolve')
// const replace = require('@rollup/plugin-replace')
// const path = require('path')
// const fs = require('fs/promises')
// const { version, name, dependencies } = require('../package.json')

import * as rollup from 'rollup'
import { terser } from 'rollup-plugin-terser'
import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import path from 'path'
import { createRequire } from "module";
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);

const { version, name, dependencies } = require("../package.json");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const resolve = p => {
  return path.resolve(__dirname, '../', p)
}

const buildEntry = async (opts) => {
  let minify = opts.dest.endsWith('.prd.js')

  let buildDeclaration = opts.dest.includes('.esm')

  if (buildDeclaration) {
    const bundle = await rollup.rollup({
      input: opts.entry,
      plugins: [
        typescript({
          declaration: true,
          declarationMap: true,
          declarationDir: path.dirname(opts.dest),
        }),
        nodeResolve()
      ],
    })
    await bundle.write({
      dir: path.dirname(opts.dest),
      format: 'es',
    })
  }

  let plugins = [].concat(opts.plugins || [])

  if (minify) {
    plugins.push(terser({
      compress: {
        ecma: 2015,
        pure_getters: true,
      },
    }))
  }
  plugins.push(
    typescript(),
  )
  plugins.push(
    replace({ values: opts.replaces, preventAssignment: true }),
    nodeResolve()
  )

  let config = {
    input: opts.entry,
    external: opts.external,
    plugins,
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    }
  }
  console.log(path.dirname(opts.dest))
  // create a bundle
  const bundle = await rollup.rollup(config);
  // or write the bundle to disk
  await bundle.write({
    file: opts.dest,
    format: opts.format,
    banner: opts.banner,
  });
}

const build = async ({ entry, destDir, external, ...rest }) => {
  // await fs.remove(path.join(opts.target, 'dist'))

  await buildEntry({
    entry,
    dest: path.join(destDir, 'index.cjs.js'),
    format: 'cjs',
    replaces: {
      __DEV__: true,
      'process.env.NODE_ENV': `'development'`,
    },
    ...rest,
  })

  await buildEntry({
    entry,
    dest: path.join(destDir, 'index.cjs.prd.js'),
    format: 'cjs',
    replaces: {
      __DEV__: false,
      'process.env.NODE_ENV': `'production'`,
    },
    ...rest,
  })

  await buildEntry({
    entry,
    dest: path.join(destDir, 'index.esm-bundler.js'),
    format: 'es',
    replaces: {
      __DEV__: `(process.env.NODE_ENV !== 'production')`,
    },
    external,
    ...rest
  })
}

const banner =
  '/*!\n' +
  ` * ${name} v${version}\n` +
  ` * (c) 2021-present reruin\n` +
  ' * Released under the MIT License.\n' +
  ' */'

build({
  entry: resolve('src/index.ts'),
  destDir: resolve('dist'),
  banner: banner,
  external: Object.keys(dependencies)
  // external: ['@vue/reactivity', '@vue/runtime-core']
});