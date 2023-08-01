"use strict";
/* Copyright © 2023 Richard Rodger and other contributors, MIT License. */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cmds = void 0;
const hoek_1 = __importDefault(require("@hapi/hoek"));
const utils_1 = require("./utils");
// NOTE: The function name prefix (lowercased) is the command name.
const HelloCmd = (spec) => {
    var _a, _b;
    const { context, respond } = spec;
    let out = {
        version: context.seneca.version,
        id: context.seneca.id,
        when: Date.now(),
        address: (_b = (_a = context.input) === null || _a === void 0 ? void 0 : _a.address) === null || _b === void 0 ? void 0 : _b.call(context.input),
    };
    return respond(null, JSON.stringify(out));
};
const GetCmd = (spec) => {
    const { argstr, context, respond } = spec;
    let option_path = argstr.trim();
    let sopts = context.seneca.options();
    let out = hoek_1.default.reach(sopts, option_path);
    return respond(null, out);
};
const DepthCmd = (spec) => {
    const { argstr, context, options, respond } = spec;
    let depth = parseInt(argstr, 10);
    depth = isNaN(depth) ? null : depth;
    context.inspekt = (0, utils_1.makeInspect)(context, {
        ...options.inspect,
        depth: depth,
    });
    return respond(null, 'Inspection depth set to ' + depth);
};
const PlainCmd = (spec) => {
    const { context, respond } = spec;
    context.plain = !context.plain;
    return respond();
};
const ListCmd = (spec) => {
    const { context, argstr, respond } = spec;
    let parts = argstr.trim().split(/\s+/);
    // console.log('PARTS', parts)
    if (0 < parts.length) {
        if (parts[0].match(/^plugins?$/)) {
            return respond(null, Object.keys(context.seneca.list_plugins()));
        }
    }
    let narrow = context.seneca.util.Jsonic(argstr);
    return respond(null, context.seneca.list(narrow));
};
const FindCmd = (spec) => {
    const { context, argstr, respond } = spec;
    let narrow = context.seneca.util.Jsonic(argstr);
    if ('string' === typeof narrow) {
        // console.log('FP', narrow)
        let plugin = context.seneca.find_plugin(narrow);
        // console.log('FP p', plugin)
        return respond(null, plugin);
    }
    respond(null, context.seneca.find(narrow));
};
const PriorCmd = (spec) => {
    const { context, argstr, respond } = spec;
    let pdesc = (actdef) => {
        let d = {
            id: actdef.id,
            plugin: actdef.plugin_fullname,
            pattern: actdef.pattern,
            callpoint: undefined,
        };
        if (actdef.callpoint) {
            d.callpoint = actdef.callpoint;
        }
        return d;
    };
    let narrow = context.seneca.util.Jsonic(argstr);
    let actdef = context.seneca.find(narrow);
    let priors = [pdesc(actdef)];
    let pdef = actdef;
    while (null != (pdef = pdef.priordef)) {
        priors.push(pdesc(pdef));
    }
    respond(null, priors);
};
const HistoryCmd = (spec) => {
    const { context, respond } = spec;
    return respond(null, context.history.join('\n'));
};
const LogCmd = (spec) => {
    const { context, argstr, respond } = spec;
    let m = null;
    if (!context.log_capture) {
        context.log_match = null;
    }
    if ((m = argstr.match(/^\s*match\s+(.*)/))) {
        context.log_capture = true; // using match always turns logging on
        context.log_match = m[1];
    }
    return respond();
};
const SetCmd = (spec) => {
    const { context, argstr, options, respond } = spec;
    let m = argstr.match(/^\s*(\S+)\s+(\S+)/);
    if (m) {
        let setopt = (0, utils_1.parseOption)(m[1], context.seneca.util.Jsonic('$:' + m[2]).$);
        context.seneca.options(setopt);
        if (setopt.repl) {
            Object.assign(options, context.seneca.util.deepextend(options, setopt.repl));
        }
        return respond();
    }
    else {
        return respond('ERROR: expected set <path> <value>');
    }
};
const AliasCmd = (spec) => {
    const { context, argstr, respond } = spec;
    let m = argstr.match(/^\s*(\S+)\s+(.+)[\r\n]?/);
    if (m) {
        context.alias[m[1]] = m[2];
        return respond();
    }
    else {
        return respond('ERROR: expected alias <name> <command>');
    }
};
const TraceCmd = (spec) => {
    const { context, respond } = spec;
    context.act_trace = !context.act_trace;
    return respond();
};
const HelpCmd = (spec) => {
    const { context, respond } = spec;
    return respond(null, context.cmdMap);
};
const CanonQueryRE = /^\s*(([^\s\/]+)\/?([^\s\/]+)?\/?([^\s\/]+)?)(\s+.+)?$/;
const List$Cmd = (spec) => {
    const { context, argstr, respond } = spec;
    let m = argstr.match(CanonQueryRE);
    if (m) {
        let canon = m[1];
        let qstr = m[5];
        let seneca = context.seneca;
        let query = seneca.util.Jsonic(qstr);
        seneca.entity(canon).list$(query, function (err, out) {
            if (err) {
                return respond('ERROR: entity list$: ', err.message);
            }
            return respond(null, out);
        });
    }
    else {
        return respond('ERROR: expected: list$ [[zone/]base/]name [query]');
    }
};
const Load$Cmd = (spec) => {
    const { context, argstr, respond } = spec;
    let m = argstr.match(CanonQueryRE);
    if (m) {
        let canon = m[1];
        let qstr = m[5];
        let seneca = context.seneca;
        let query = seneca.util.Jsonic(qstr);
        seneca.entity(canon).load$(query, function (err, out) {
            if (err) {
                return respond('ERROR: entity load$: ', err.message);
            }
            return respond(null, out);
        });
    }
    else {
        return respond('ERROR: expected: load$ [[zone/]base/]name [query]');
    }
};
const Save$Cmd = (spec) => {
    const { context, argstr, respond } = spec;
    let m = argstr.match(CanonQueryRE);
    if (m) {
        let canon = m[1];
        let qstr = m[5];
        let seneca = context.seneca;
        let query = seneca.util.Jsonic(qstr);
        seneca.entity(canon).save$(query, function (err, out) {
            if (err) {
                return respond('ERROR: entity save$: ', err.message);
            }
            return respond(null, out);
        });
    }
    else {
        return respond('ERROR: expected: save$ [[zone/]base/]name [query]');
    }
};
const Remove$Cmd = (spec) => {
    const { context, argstr, respond } = spec;
    let m = argstr.match(CanonQueryRE);
    if (m) {
        let canon = m[1];
        let qstr = m[5];
        let seneca = context.seneca;
        let query = seneca.util.Jsonic(qstr);
        seneca.entity(canon).load$(query, function (err, out) {
            if (err) {
                return respond('ERROR: entity remove$: ', err.message);
            }
            return respond(null, out);
        });
    }
    else {
        return respond('ERROR: expected: remove$ [[zone/]base/]name [query]');
    }
};
const Entity$Cmd = (spec) => {
    const { context, argstr, respond } = spec;
    let m = argstr.match(CanonQueryRE);
    if (m) {
        let canon = m[1];
        // let qstr = m[5]
        let seneca = context.seneca;
        // let query = seneca.util.Jsonic(qstr)
        let ent = seneca.entity(canon);
        return respond(null, ent);
    }
    else {
        return respond('ERROR: expected: entity$ [[zone/]base/]name [query]');
    }
};
const Cmds = {
    HelloCmd,
    GetCmd,
    DepthCmd,
    PlainCmd,
    // QuitCmd,
    ListCmd,
    FindCmd,
    PriorCmd,
    HistoryCmd,
    LogCmd,
    SetCmd,
    AliasCmd,
    TraceCmd,
    HelpCmd,
    List$Cmd,
    Load$Cmd,
    Save$Cmd,
    Remove$Cmd,
    Entity$Cmd,
};
exports.Cmds = Cmds;
//# sourceMappingURL=cmds.js.map