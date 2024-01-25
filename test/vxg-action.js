'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
module.exports = function make_foo_bar() {
  return async function foo_bar(msg, meta) {
    const seneca = this

    const g = seneca.context.getGlobal()

    let out = { ok: true, why: '' }
    out.z = 3 * msg.z

    g.console.log('LOG------------', out)

    return out
  }
}
//# sourceMappingURL=ingest_podcast.js.map
