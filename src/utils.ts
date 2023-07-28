/* Copyright © 2015-2023 Richard Rodger and other contributors, MIT License. */

import Util from 'node:util'


function makeInspect(context: any, inspect_options: any) {
  return (x: any) => {
    if (context.plain) {
      x = JSON.parse(JSON.stringify(x))
    }
    return Util.inspect(x, inspect_options)
  }
}


function parseOption(optpath: any, val: any) {
  optpath += '.'

  let part = /([^.]+)\.+/g
  let m
  let out = {}
  let cur: any = out
  let po: any = out
  let pn: any

  while (null != (m = part.exec(optpath))) {
    cur[m[1]] = {}
    po = cur
    pn = m[1]
    cur = cur[m[1]]
  }
  po[pn] = val
  return out
}


export {
  makeInspect,
  parseOption,
}
