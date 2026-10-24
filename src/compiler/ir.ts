import type { Kind, ValueType } from '../engine/types';

export type LiteralValue = string | number | boolean | null | Record<string, unknown> | unknown[];

export type ExprIR =
  | { kind: 'literal'; value: LiteralValue; valueType: ValueType }
  | { kind: 'read_input'; inputId: string; valueType: ValueType }
  | { kind: 'read_state'; key: string; valueType: ValueType }
  | { kind: 'read_var'; name: string; valueType: ValueType }
  | {
      kind: 'call_operation';
      operation: string;
      args: ExprIR[];
      valueType: ValueType;
    }
  | {
      kind: 'unary_op';
      op: 'not' | 'neg';
      expr: ExprIR;
      valueType: ValueType;
    }
  | {
      kind: 'binary_op';
      op: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'and' | 'or' | 'add' | 'sub' | 'contains';
      left: ExprIR;
      right: ExprIR;
      valueType: ValueType;
    };

export type InstructionIR =
  | { kind: 'assign_state'; key: string; value: ExprIR }
  | { kind: 'assign_var'; name: string; value: ExprIR }
  | {
      kind: 'call_operation';
      operation: string;
      args: ExprIR[];
      targetVar?: string;
    }
  | { kind: 'sequence'; instructions: InstructionIR[] }
  | {
      kind: 'conditional';
      condition: ExprIR;
      thenBranch: InstructionIR[];
      elseBranch?: InstructionIR[];
    }
  | {
      kind: 'switch';
      expr: ExprIR;
      cases: { value: LiteralValue; branch: InstructionIR[] }[];
      defaultBranch?: InstructionIR[];
    }
  | { kind: 'return'; value?: ExprIR }
  | { kind: 'navigate'; targetScreenId: string }
  | {
      kind: 'notify';
      message: ExprIR;
      notifyType: 'success' | 'error' | 'info' | 'warning';
      duration?: number;
    }
  | { kind: 'delay'; durationMs: number }
  | {
      kind: 'try_catch';
      body: InstructionIR[];
      catchVar?: string;
      catchBranch: InstructionIR[];
    }
  | {
      kind: 'adapter_call';
      adapter: 'auth' | 'api' | 'database';
      action: string;
      payload: Record<string, ExprIR>;
      targetVar?: string;
    };

export type StepIR = {
  id: string;
  blockId: string;
  kind: Kind;
  label: string;
  instructions: InstructionIR[];
};

export type ScreenIR = {
  id: string;
  name: string;
  handlers: Record<string, InstructionIR[]>;
};

export type ProgramIR = {
  version: 1;
  name: string;
  screens: ScreenIR[];
  entryScreenId?: string;
  steps: StepIR[];
};
