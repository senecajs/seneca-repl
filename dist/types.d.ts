type CmdSpec = {
    name: string;
    argstr: string;
    context: any;
    options: Record<string, any>;
    respond: Function;
};
type Cmd = (spec: CmdSpec) => void;
export type { CmdSpec, Cmd, };
