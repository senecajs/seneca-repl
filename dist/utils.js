"use strict";
/* Copyright © 2015-2023 Richard Rodger and other contributors, MIT License. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeInspect = makeInspect;
exports.parseOption = parseOption;
const node_util_1 = __importDefault(require("node:util"));
function makeInspect(context, inspect_options) {
    return (x) => {
        if (context.plain) {
            x = JSON.parse(JSON.stringify(x));
        }
        return node_util_1.default.inspect(x, inspect_options);
    };
}
function parseOption(optpath, val) {
    optpath += '.';
    let part = /([^.]+)\.+/g;
    let m;
    let out = {};
    let cur = out;
    let po = out;
    let pn;
    while (null != (m = part.exec(optpath))) {
        cur[m[1]] = {};
        po = cur;
        pn = m[1];
        cur = cur[m[1]];
    }
    po[pn] = val;
    return out;
}
//# sourceMappingURL=utils.js.map