import { isStretchName } from "./exerciseDb";

/*
 * parser.ts
 *
 * A standalone, dependency-free re-implementation of Liftosaur's Liftoscript
 * evaluation logic (https://github.com/astashov/liftosaur, src/liftoscriptEvaluator.ts,
 * src/models/weight.ts) plus the exercise-line parser used by the Obsidian plugin.
 *
 * It implements:
 *   - a lexer matching liftoscript.grammar
 *   - a recursive-descent parser producing an AST
 *   - an evaluator matching LiftoscriptEvaluator.evaluate() semantics
 *     (numbers, weights lb/kg, percentages, arrays with index/wildcard/range,
 *      arithmetic, boolean logic, ternary, if/for, assignment, state variables,
 *      builtin functions, unary not)
 *   - exercise block parsing: "Exercise Name / 5x5 100lb, 2:00 rest / ..."
 *   - linear progression ("progress: lp(...)") helpers for next-session values
 */

export type Unit = "kg" | "lb";
export type IWeight = { value: number; unit: Unit };
export type IPercentage = { value: number; unit: "%" };
export type WeightLike = number | IWeight | IPercentage;

export type ScalarValue = number | IWeight | IPercentage;
export type EvalValue = ScalarValue | boolean | (ScalarValue | undefined)[] | undefined;

const DEFAULT_UNIT: Unit = "lb";

/** Matches a manual "type: stretch" tag on an exercise line. */
const STRETCH_TAG_RE = /type\s*:\s*stretch\b/i;

/**
 * True when the exercise name matches a "stretch" entry in the active database
 * (P22/P23): stretch detection is delegated to exerciseDb so it follows the
 * currently selected dataset and the Free-DB "stretching" normalization.
 */
export function isStretchExerciseName(name: string): boolean {
  return isStretchName(name);
}

/* ------------------------------------------------------------------ */
/* Weight helpers (ported from src/models/weight.ts)                   */
/* ------------------------------------------------------------------ */

export function weightIs(value: unknown): value is IWeight {
  return (
    typeof (value as IWeight)?.value === "number" &&
    typeof (value as IWeight)?.unit === "string" &&
    (value as { unit?: string })?.unit !== "%"
  );
}

export function weightIsPct(value: unknown): value is IPercentage {
  return typeof (value as IPercentage)?.value === "number" && (value as IPercentage)?.unit === "%";
}

export function weightBuild(value: number, unit: Unit): IWeight {
  return { value, unit };
}

export function weightBuildPct(value: number): IPercentage {
  return { value, unit: "%" };
}

export function weightConvertTo(weight: IWeight, unit: Unit): IWeight {
  if (weight.unit === unit) {
    return weight;
  } else if (weight.unit === "kg" && unit === "lb") {
    return weightBuild(Math.round((weight.value * 2.205) / 0.5) * 0.5, unit);
  } else {
    return weightBuild(Math.round(weight.value / 2.205 / 0.5) * 0.5, unit);
  }
}

export function weightOperation(
  weight: IWeight | number,
  value: IWeight | number,
  o: (a: number, b: number) => number
): IWeight {
  if (typeof weight === "number" && typeof value !== "number") {
    return weightBuild(o(weight, value.value), value.unit);
  } else if (typeof weight !== "number" && typeof value === "number") {
    return weightBuild(o(weight.value, value), weight.unit);
  } else if (typeof weight !== "number" && typeof value !== "number") {
    return weightBuild(o(weight.value, weightConvertTo(value, weight.unit).value), weight.unit);
  } else {
    throw new Error("Weight.operation should never work with numbers only");
  }
}

function roundTo005(value: number): number {
  return Math.round(value / 0.005) * 0.005;
}

export function weightOp(
  onerm: IWeight | undefined,
  a: WeightLike,
  b: WeightLike,
  o: (x: number, y: number) => number
): WeightLike {
  if (typeof a === "number" && typeof b === "number") {
    return o(a, b);
  }
  if (typeof a === "number" && weightIsPct(b)) {
    return weightBuildPct(o(a, b.value));
  }
  if (typeof a === "number" && weightIs(b)) {
    return weightOperation(a, b, o);
  }

  if (weightIsPct(a) && typeof b === "number") {
    return weightBuildPct(o(a.value, b));
  }
  if (weightIsPct(a) && weightIsPct(b)) {
    return weightBuildPct(o(a.value, b.value));
  }
  if (weightIsPct(a) && weightIs(b)) {
    const aWeight = onerm ? weightOperation(onerm, a.value / 100, (x, y) => x * y) : a.value / 100;
    return weightOperation(aWeight, b, o);
  }

  if (weightIs(a) && typeof b === "number") {
    return weightOperation(a, b, o);
  }
  if (weightIs(a) && weightIsPct(b)) {
    const bWeight = onerm ? weightOperation(onerm, b.value / 100, (x, y) => x * y) : b.value / 100;
    return weightOperation(a, bWeight, o);
  }
  if (weightIs(a) && weightIs(b)) {
    return weightOperation(a, b, o);
  }

  throw new Error(`Can't apply operation to ${JSON.stringify(a)} and ${JSON.stringify(b)}`);
}

export function weightApplyOp(
  onerm: IWeight | undefined,
  oldValue: WeightLike,
  value: WeightLike,
  opr: "+=" | "-=" | "*=" | "/=" | "="
): WeightLike {
  if (opr === "=") {
    return value;
  } else if (opr === "+=") {
    return weightOp(onerm, oldValue, value, (a, b) => a + b);
  } else if (opr === "-=") {
    return weightOp(onerm, oldValue, value, (a, b) => a - b);
  } else if (opr === "*=") {
    return weightOp(onerm, oldValue, value, (a, b) => roundTo005(a * b));
  } else {
    return weightOp(onerm, oldValue, value, (a, b) => roundTo005(a / b));
  }
}

export function weightConvertToWeight(
  onerm: IWeight,
  value: WeightLike,
  unit: Unit
): IWeight {
  if (typeof value === "number") {
    return weightBuild(value, unit);
  } else if (weightIsPct(value)) {
    return weightConvertTo(weightOperation(onerm, Math.round((value.value / 100) * 1e4) / 1e4, (a, b) => a * b), unit);
  } else {
    return value;
  }
}

function weightComparison(weight: WeightLike, value: WeightLike, o: (a: number, b: number) => boolean): boolean {
  if (typeof weight === "number" && typeof value === "number") {
    return o(weight, value);
  } else if (typeof weight === "number" && typeof value !== "number") {
    return o(weight, value.value);
  } else if (typeof weight !== "number" && typeof value === "number") {
    return o(weight.value, value);
  } else if (typeof weight !== "number" && typeof value !== "number") {
    if (weight.unit === "%" && value.unit === "%") {
      return o(weight.value, value.value);
    } else if (weightIs(weight) && weightIs(value)) {
      return o(weight.value, weightConvertTo(value, weight.unit).value);
    } else {
      return false;
    }
  } else {
    return false;
  }
}

export function weightGt(a: WeightLike, b: WeightLike): boolean {
  return weightComparison(a, b, (x, y) => x > y);
}
export function weightLt(a: WeightLike, b: WeightLike): boolean {
  return weightComparison(a, b, (x, y) => x < y);
}
export function weightGte(a: WeightLike, b: WeightLike): boolean {
  return weightComparison(a, b, (x, y) => x >= y);
}
export function weightLte(a: WeightLike, b: WeightLike): boolean {
  return weightComparison(a, b, (x, y) => x <= y);
}
export function weightEq(a: WeightLike, b: WeightLike): boolean {
  return weightComparison(a, b, (x, y) => x === y);
}

export function weightPrint(weight: WeightLike): string {
  if (typeof weight === "number") {
    return `${Math.round(weight * 1e2) / 1e2}`;
  } else if (weightIsPct(weight)) {
    return `${weight.value}%`;
  } else {
    return `${Math.round(weight.value * 1e2) / 1e2} ${weight.unit}`;
  }
}

/* ------------------------------------------------------------------ */
/* Syntax error                                                        */
/* ------------------------------------------------------------------ */

export class LiftoscriptSyntaxError extends SyntaxError {
  public readonly line: number;
  public readonly offset: number;
  constructor(message: string, line = 0, offset = 0) {
    super(message);
    this.line = line;
    this.offset = offset;
  }
}

/* ------------------------------------------------------------------ */
/* Lexer                                                               */
/* ------------------------------------------------------------------ */

type TokenType =
  | "number"
  | "weight"
  | "percentage"
  | "keyword"
  | "state"
  | "variable"
  | "plus"
  | "times"
  | "cmp"
  | "andor"
  | "not"
  | "incAssign"
  | "assign"
  | "lparen"
  | "rparen"
  | "lbrace"
  | "rbrace"
  | "lbracket"
  | "rbracket"
  | "comma"
  | "question"
  | "colon"
  | "wildcard"
  | "current"
  | "dot"
  | "in"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  col: number;
}

const PLUS_OPS = ["+", "-"];
const TIMES_OPS = ["*", "/", "%"];
const CMP_OPS = [">", ">=", "==", "!=", "<", "<="];
const ANDOR_OPS = ["&&", "||"];
const INC_ASSIGNS = ["+=", "-=", "*=", "/="];

export function tokenize(script: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let lastNewline = -1;

  const col = () => i - lastNewline;

  while (i < script.length) {
    const ch = script[i];

    if (ch === "\n") {
      line += 1;
      lastNewline = i;
      i += 1;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === ";" || (ch === "{" && script[i + 1] === "~") || (ch === "~" && script[i + 1] === "}")) {
      i += 1;
      continue;
    }
    if (ch === "/" && script[i + 1] === "/") {
      while (i < script.length && script[i] !== "\n") {
        i += 1;
      }
      continue;
    }

    const start = i;
    const startLine = line;
    const startCol = col();

    // Numbers
    if (ch >= "0" && ch <= "9") {
      let num = "";
      while (i < script.length && /[0-9]/.test(script[i])) {
        num += script[i];
        i += 1;
      }
      if (script[i] === ".") {
        num += ".";
        i += 1;
        while (i < script.length && /[0-9]/.test(script[i])) {
          num += script[i];
          i += 1;
        }
      }
      // Unit?
      if (script[i] === "l" && script[i + 1] === "b") {
        i += 2;
        tokens.push({ type: "weight", value: `${num} lb`, start, end: i, line: startLine, col: startCol });
      } else if (script[i] === "k" && script[i + 1] === "g") {
        i += 2;
        tokens.push({ type: "weight", value: `${num} kg`, start, end: i, line: startLine, col: startCol });
      } else if (script[i] === "%") {
        i += 1;
        tokens.push({ type: "percentage", value: num, start, end: i, line: startLine, col: startCol });
      } else {
        tokens.push({ type: "number", value: num, start, end: i, line: startLine, col: startCol });
      }
      continue;
    }
    // number starting with "."
    if (ch === "." && i + 1 < script.length && /[0-9]/.test(script[i + 1])) {
      let num = ".";
      i += 1;
      while (i < script.length && /[0-9]/.test(script[i])) {
        num += script[i];
        i += 1;
      }
      tokens.push({ type: "number", value: num, start, end: i, line: startLine, col: startCol });
      continue;
    }

    // keywords / state / variable
    if (/[a-zA-Z_]/.test(ch)) {
      let word = "";
      while (i < script.length && /[a-zA-Z0-9_]/.test(script[i])) {
        word += script[i];
        i += 1;
      }
      // var.xxx
      if (word === "var" && script[i] === ".") {
        i += 1;
        let name = "var.";
        while (i < script.length && /[a-zA-Z0-9_]/.test(script[i])) {
          name += script[i];
          i += 1;
        }
        tokens.push({ type: "variable", value: name, start, end: i, line: startLine, col: startCol });
        continue;
      }
      if (word === "state") {
        tokens.push({ type: "state", value: word, start, end: i, line: startLine, col: startCol });
      } else if (word === "in") {
        tokens.push({ type: "in", value: word, start, end: i, line: startLine, col: startCol });
      } else {
        tokens.push({ type: "keyword", value: word, start, end: i, line: startLine, col: startCol });
      }
      continue;
    }

    // multi-char operators
    const two = script.substr(i, 2);
    const three = script.substr(i, 3);
    if (INC_ASSIGNS.indexOf(two) !== -1) {
      tokens.push({ type: "incAssign", value: two, start, end: i + 2, line: startLine, col: startCol });
      i += 2;
      continue;
    }
    if (ANDOR_OPS.indexOf(two) !== -1) {
      tokens.push({ type: "andor", value: two, start, end: i + 2, line: startLine, col: startCol });
      i += 2;
      continue;
    }
    if (["==", "!=", ">=", "<="].indexOf(two) !== -1) {
      tokens.push({ type: "cmp", value: two, start, end: i + 2, line: startLine, col: startCol });
      i += 2;
      continue;
    }
    if (["->", ">=", "<="].indexOf(three) !== -1) {
      // no-op; handled above
    }

    const solo: Record<string, TokenType> = {
      "+": "plus",
      "-": "plus",
      "*": "times",
      "/": "times",
      "%": "times",
      ">": "cmp",
      "<": "cmp",
      "!": "not",
      "(": "lparen",
      ")": "rparen",
      "{": "lbrace",
      "}": "rbrace",
      "[": "lbracket",
      "]": "rbracket",
      ",": "comma",
      "?": "question",
      ":": "colon",
      "_": "current",
      ".": "dot",
      "=": "assign",
    };
    // note "*" is tokenized as "times" and disambiguated to wildcard contextually in the parser
    const soloType = solo[ch];
    if (soloType !== undefined) {
      tokens.push({ type: soloType, value: ch, start, end: i + 1, line: startLine, col: startCol });
      i += 1;
      continue;
    }

    throw new LiftoscriptSyntaxError(`Unexpected character '${ch}'`, startLine, startCol);
  }

  tokens.push({ type: "eof", value: "", start: i, end: i, line, col: col() });
  return tokens;
}

/* ------------------------------------------------------------------ */
/* AST                                                                 */
/* ------------------------------------------------------------------ */

type AssignmentOp = "+=" | "-=" | "*=" | "/=" | "=";

interface Bindings {
  day: number;
  week: number;
  dayInWeek: number;
  originalWeights: (IWeight | IPercentage)[];
  weights: (IWeight | IPercentage | undefined)[];
  completedWeights: (IWeight | undefined)[];
  rm1: IWeight;
  reps: (number | undefined)[];
  minReps: (number | undefined)[];
  amraps: (number | undefined)[];
  askweights: (number | undefined)[];
  logrpes: (number | undefined)[];
  timers: (number | undefined)[];
  setTime: (number | undefined)[];
  completedSetTime: (number | undefined)[];
  RPE: (number | undefined)[];
  completedRPE: (number | undefined)[];
  completedReps: (number | undefined)[];
  completedRepsLeft: (number | undefined)[];
  isCompleted: number[];
  w: (IWeight | undefined)[];
  r: (number | undefined)[];
  mr: (number | undefined)[];
  cr: (number | undefined)[];
  cw: (IWeight | undefined)[];
  ns: number;
  programNumberOfSets: number;
  numberOfSets: number;
  completedNumberOfSets: number;
  setVariationIndex: number;
  exerciseVariationIndex: number;
  descriptionIndex: number;
  bodyweight: IWeight;
  setIndex: number;
  other?: Record<number, IProgramState>;
}

export type IProgramState = Record<string, WeightLike>;

type BuiltinName = keyof typeof BUILTIN_FNS;

/* ------------------------------------------------------------------ */
/* Parser (recursive descent matching liftoscript.grammar)             */
/* ------------------------------------------------------------------ */

type AstNode =
  | { kind: "Literal"; value: number | IWeight | IPercentage }
  | { kind: "Variable"; name: string; explicit: boolean }
  | { kind: "StateVar"; key: string; index?: AstNode }
  | { kind: "VarExpr"; name: string; indexes?: { from?: AstNode; to?: AstNode }[] }
  | { kind: "Binary"; op: string; left: AstNode; right: AstNode }
  | { kind: "Unary"; op: string; operand: AstNode }
  | { kind: "Ternary"; cond: AstNode; then: AstNode; or: AstNode }
  | { kind: "Paren"; expr: AstNode }
  | { kind: "Block"; statement: boolean; body: AstNode[] }
  | { kind: "If"; branches: { cond: AstNode; body: AstNode }[]; or?: AstNode }
  | { kind: "For"; varName: string; iter: AstNode; body: AstNode }
  | { kind: "Assign"; target: AstNode; op: AssignmentOp; value: AstNode }
  | { kind: "Call"; name: string; args: AstNode[] };

class Parser {
  private pos = 0;
  private readonly tokens: Token[];
  private readonly script: string;

  constructor(script: string, tokens: Token[]) {
    this.script = script;
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }
  private match(...types: TokenType[]): Token | undefined {
    const t = this.peek();
    if (types.indexOf(t.type) !== -1) {
      return this.next();
    }
    return undefined;
  }
  private expect(type: TokenType, what: string): Token {
    const t = this.next();
    if (t.type !== type) {
      throw new LiftoscriptSyntaxError(`Expected ${what}, got '${t.value}'`, t.line, t.col);
    }
    return t;
  }
  private errorAt(tok: Token, message: string): never {
    throw new LiftoscriptSyntaxError(message, tok.line, tok.col);
  }

  parseProgram(): AstNode[] {
    const stmts: AstNode[] = [];
    while (this.peek().type !== "eof") {
      stmts.push(this.parseExpression(0));
    }
    return stmts;
  }

  private bindingPower(): number {
    const t = this.peek();
    switch (t.type) {
      case "assign":
      case "incAssign":
        return 10;
      case "question":
        return 20;
      case "andor":
        return 30;
      case "cmp":
        return 40;
      case "plus":
        return 50;
      case "times":
        return 60;
      case "lparen":
      case "lbracket":
        return 70;
      case "not":
        return 90;
      default:
        return 0;
    }
  }

  private parseExpression(minBp: number): AstNode {
    let left = this.parsePrefix();

    for (;;) {
      const t = this.peek();
      if (t.type === "eof") {
        break;
      }
      const bp = this.bindingPower();
      if (bp < minBp) {
        break;
      }

      if (t.type === "assign" || t.type === "incAssign") {
        const op = (t.type === "assign" ? "=" : t.value) as AssignmentOp;
        this.next();
        const right = this.parseExpression(bp);
        left = { kind: "Assign", target: left, op, value: right };
        continue;
      }
      if (t.type === "question") {
        this.next();
        const then = this.parseExpression(0);
        this.expect("colon", "':'");
        const or = this.parseExpression(bp);
        left = { kind: "Ternary", cond: left, then, or };
        continue;
      }
      if (t.type === "plus" || t.type === "times" || t.type === "cmp" || t.type === "andor") {
        const op = t.value;
        this.next();
        const right = this.parseExpression(bp);
        left = { kind: "Binary", op, left, right };
        continue;
      }
      if (t.type === "lparen") {
        this.next();
        const args: AstNode[] = [];
        if (this.peek().type !== "rparen") {
          args.push(this.parseExpression(0));
          while (this.match("comma")) {
            args.push(this.parseExpression(0));
          }
        }
        this.expect("rparen", "')'");
        if (left.kind === "Variable") {
          left = { kind: "Call", name: left.name, args };
        } else {
          this.errorAt(t, "Only function calls are allowed here");
        }
        continue;
      }
      if (t.type === "lbracket") {
        this.next();
        // index: expr, expr:expr, *, or _
        if (this.peek().type === "times" && this.peek().value === "*") {
          this.next();
          this.expect("rbracket", "']'");
          left = this.toIndexable(left);
          left = this.appendIndex(left, undefined, undefined, true);
          continue;
        } else if (this.peek().type === "current") {
          this.next();
          this.expect("rbracket", "']'");
          left = this.toIndexable(left);
          left = this.appendIndex(left, undefined, undefined, true, true);
          continue;
        } else {
          left = this.toIndexable(left);
          const from = this.parseExpression(0);
          if (this.match("colon")) {
            const to = this.parseExpression(0);
            this.expect("rbracket", "']'");
            left = this.appendIndex(left, from, to, false);
          } else {
            this.expect("rbracket", "']'");
            left = this.appendIndex(left, from, undefined, false);
          }
          continue;
        }
      }
      break;
    }

    return left;
  }

  private toIndexable(node: AstNode): AstNode {
    if (node.kind === "Variable") {
      return { kind: "VarExpr", name: node.name, indexes: [] };
    }
    return node;
  }

  private appendIndex(
    node: AstNode,
    from?: AstNode,
    to?: AstNode,
    wildcard = false,
    current = false
  ): AstNode {
    if (node.kind === "VarExpr") {
      node.indexes = [...(node.indexes || []), { from, to }];
      return node;
    }
    if (node.kind === "StateVar") {
      if (current) {
        return { ...node, index: undefined };
      }
      node.index = from;
      return node;
    }
    this.errorAt({ ...this.peek(), type: "lbracket" } as Token, `Cannot index this expression`);
    return node;
  }

  private parsePrefix(): AstNode {
    const t = this.peek();

    // unary not
    if (t.type === "not") {
      this.next();
      const operand = this.parseExpression(70);
      return { kind: "Unary", op: "not", operand };
    }

    if (t.type === "number" || t.type === "weight" || t.type === "percentage") {
      this.next();
      if (t.type === "number") {
        return { kind: "Literal", value: parseFloat(t.value) };
      } else if (t.type === "weight") {
        const [num, unit] = t.value.split(" ");
        return { kind: "Literal", value: weightBuild(parseFloat(num), unit as Unit) };
      } else {
        return { kind: "Literal", value: weightBuildPct(parseFloat(t.value)) };
      }
    }

    if (t.type === "plus") {
      // signed number
      const sign = t.value;
      this.next();
      if (this.peek().type === "number" || this.peek().type === "weight" || this.peek().type === "percentage") {
        const lit = this.next();
        if (lit.type === "number") {
          const v = parseFloat(lit.value);
          return { kind: "Literal", value: sign === "-" ? -v : v };
        } else if (lit.type === "weight") {
          const [num, unit] = lit.value.split(" ");
          const v = parseFloat(num);
          return {
            kind: "Literal",
            value: weightBuild(sign === "-" ? -v : v, unit as Unit),
          };
        } else {
          const v = parseFloat(lit.value);
          return { kind: "Literal", value: weightBuildPct(sign === "-" ? -v : v) };
        }
      }
      this.errorAt(t, "Expected number");
    }

    // reserved keywords: if / else / for
    if (t.type === "keyword" && (t.value === "if" || t.value === "for" || t.value === "else")) {
      if (t.value === "if") {
        this.next();
        const branches: { cond: AstNode; body: AstNode }[] = [];
        const condExpr = this.parseExpression(0);
        const bodyBlock = this.parseBlockIfNeeded();
        branches.push({ cond: condExpr, body: bodyBlock });
        while (this.peek().type === "keyword" && this.peek().value === "else") {
          this.next();
          if (this.peek().type === "keyword" && this.peek().value === "if") {
            this.next();
            const condExpr2 = this.parseExpression(0);
            const bodyBlock2 = this.parseBlockIfNeeded();
            branches.push({ cond: condExpr2, body: bodyBlock2 });
          } else {
            const orBlock = this.parseBlockIfNeeded();
            return { kind: "If", branches, or: orBlock };
          }
        }
        return { kind: "If", branches };
      } else if (t.value === "for") {
        this.next();
        this.expect("lparen", "'('");
        const varTok = this.next();
        if (varTok.type !== "variable" && varTok.type !== "keyword") {
          this.errorAt(varTok, "Expected loop variable");
        }
        const varName = varTok.value.replace("var.", "");
        this.expect("in", "'in'");
        const iter = this.parseExpression(0);
        this.expect("rparen", "')'");
        const body = this.parseBlock();
        return { kind: "For", varName, iter, body };
      } else {
        this.errorAt(t, "Unexpected 'else'");
      }
    }

    // keyword
    if (t.type === "keyword") {
      this.next();
      const name = t.value;
      // If followed by "(" it's a call, if by "[" it's an array access - both handled in the infix loop
      return { kind: "Variable", name, explicit: false };
    }

    // state
    if (t.type === "state") {
      this.next();
      if (this.peek().type === "lbracket") {
        this.next();
        const index = this.parseExpression(0);
        this.expect("rbracket", "']'");
        this.expect("dot", "'.'");
        const keyTok = this.next();
        if (keyTok.type !== "keyword") {
          this.errorAt(keyTok, "Expected state variable name");
        }
        return { kind: "StateVar", key: keyTok.value, index };
      }
      this.expect("dot", "'.'");
      const keyTok = this.next();
      if (keyTok.type !== "keyword") {
        this.errorAt(keyTok, "Expected state variable name");
      }
      return { kind: "StateVar", key: keyTok.value };
    }

    // variable
    if (t.type === "variable") {
      this.next();
      return { kind: "Variable", name: t.value.replace("var.", ""), explicit: true };
    }

    if (t.type === "lparen") {
      this.next();
      const expr = this.parseExpression(0);
      this.expect("rparen", "')'");
      return { kind: "Paren", expr };
    }

    // block expression { ... }
    if (t.type === "lbrace") {
      this.next();
      const body: AstNode[] = [];
      while (this.peek().type !== "rbrace" && this.peek().type !== "eof") {
        body.push(this.parseExpression(0));
      }
      this.expect("rbrace", "'}'");
      return { kind: "Block", statement: false, body };
    }

    this.errorAt(t, `Unexpected token '${t.value}'`);
  }

  private tokenAfter(n: number): Token | undefined {
    return this.tokens[this.pos + n];
  }

  private parseBlock(): AstNode {
    this.expect("lbrace", "'{'");
    const body: AstNode[] = [];
    while (this.peek().type !== "rbrace" && this.peek().type !== "eof") {
      body.push(this.parseExpression(0));
    }
    this.expect("rbrace", "'}'");
    return { kind: "Block", statement: true, body };
  }

  private parseBlockIfNeeded(): AstNode {
    if (this.peek().type === "lbrace") {
      return this.parseBlock();
    }
    return this.parseExpression(0);
  }
}

const BUILTIN_FNS = {
  roundWeight: 1,
  roundConvertWeight: 1,
  calculateTrainingMax: 2,
  calculate1RM: 2,
  rpeMultiplier: 2,
  floor: 1,
  ceil: 1,
  round: 1,
  sum: -1,
  min: -1,
  max: -1,
  zeroOrGte: 2,
  print: -1,
  increment: 1,
  decrement: 1,
  sets: 9,
} as const;

/* ------------------------------------------------------------------ */
/* Evaluator                                                           */
/* ------------------------------------------------------------------ */

export interface EvaluateOptions {
  mode?: "planner" | "update";
  unit?: Unit;
}

export class LiftoscriptEvaluator {
  private readonly script: string;
  private readonly bindings: Bindings;
  private readonly state: IProgramState;
  private readonly otherStates: Record<number, IProgramState>;
  private readonly unit: Unit;
  private readonly mode: "planner" | "update";
  private readonly vars: IProgramState = {};
  public readonly updates: {
    type: string;
    value: { value: WeightLike; op: AssignmentOp; target: (number | "*")[] };
  }[] = [];

  constructor(
    script: string,
    state: IProgramState,
    otherStates: Record<number, IProgramState>,
    bindings: Bindings,
    unit: Unit = DEFAULT_UNIT,
    mode: "planner" | "update" = "planner"
  ) {
    this.script = script;
    this.state = state;
    this.otherStates = otherStates;
    this.bindings = bindings;
    this.unit = unit;
    this.mode = mode;
  }

  public parseTree(): AstNode[] {
    const tokens = tokenize(this.script);
    return new Parser(this.script, tokens).parseProgram();
  }

  public evaluateAll(): EvalValue {
    const tree = this.parseTree();
    let result: EvalValue = 0;
    for (const node of tree) {
      result = this.evaluate(node);
    }
    return result;
  }

  public execute(): WeightLike | boolean {
    let raw = this.evaluateAll();
    if (Array.isArray(raw)) {
      raw = raw[0];
    }
    if (raw == null) {
      raw = 0;
    }
    return raw;
  }

  private evaluate(node: AstNode): EvalValue {
    switch (node.kind) {
      case "Literal":
        return node.value;

      case "Paren":
        return this.evaluate(node.expr);

      case "Block": {
        let result: EvalValue = 0;
        for (const child of node.body) {
          result = this.evaluate(child);
        }
        return result;
      }

      case "Binary": {
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);
        const op = node.op;
        if (typeof left === "boolean" || typeof right === "boolean") {
          if (op === "&&") {
            return Boolean(left && right);
          } else if (op === "||") {
            return Boolean(left || right);
          } else {
            throw new LiftoscriptSyntaxError(`Unknown operator ${op}`);
          }
        }
        return this.applyBinary(op, left, right);
      }

      case "Unary":
        return !this.evaluate(node.operand);

      case "Ternary":
        return this.evaluate(node.cond) ? this.evaluate(node.then) : this.evaluate(node.or);

      case "If": {
        for (const branch of node.branches) {
          if (this.evaluate(branch.cond)) {
            return this.evaluate(branch.body);
          }
        }
        return node.or ? this.evaluate(node.or) : 0;
      }

      case "For": {
        const iter = this.evaluate(node.iter);
        if (!Array.isArray(iter)) {
          throw new LiftoscriptSyntaxError("for in expression should return an array");
        }
        for (let i = 1; i <= iter.length; i += 1) {
          this.vars[node.varName] = i;
          this.evaluate(node.body);
        }
        return iter.length;
      }

      case "Variable": {
        if (node.explicit) {
          const key = node.name;
          if (key in this.vars) {
            return this.vars[key];
          }
          throw new LiftoscriptSyntaxError(`There's no variable '${key}'`);
        }
        // plain keyword used as scalar binding (e.g. numberOfSets, ns, rm1, bodyweight)
        const name = node.name as keyof Bindings;
        const value = this.bindings[name];
        return value === undefined ? 0 : (value as EvalValue);
      }

      case "VarExpr": {
        return this.evaluateVarExpr(node);
      }

      case "StateVar": {
        return this.evaluateStateVar(node);
      }

      case "Assign": {
        return this.evaluateAssign(node);
      }

      case "Call": {
        return this.evaluateCall(node);
      }
    }
  }

  private applyBinary(op: string, left: EvalValue, right: EvalValue): EvalValue {
    if (Array.isArray(left) || Array.isArray(right)) {
      if (op === ">" || op === "<" || op === ">=" || op === "<=" || op === "==" || op === "!=") {
        const lArr = (Array.isArray(left) ? left : [left]) as (WeightLike | undefined)[];
        const rArr = (Array.isArray(right) ? right : [right]) as (WeightLike | undefined)[];
        return this.compareArrays(op, lArr, rArr);
      }
      throw new LiftoscriptSyntaxError(`You cannot apply ${op} to arrays`);
    }
    const l = left as WeightLike;
    const r = right as WeightLike;
    if (op === ">") return weightGt(l, r);
    if (op === "<") return weightLt(l, r);
    if (op === ">=") return weightGte(l, r);
    if (op === "<=") return weightLte(l, r);
    if (op === "==") return weightEq(l, r);
    if (op === "!=") return !weightEq(l, r);
    switch (op) {
      case "+":
        return weightOp(this.bindings.rm1, l, r, (a, b) => a + b);
      case "-":
        return weightOp(this.bindings.rm1, l, r, (a, b) => a - b);
      case "*":
        return weightOp(this.bindings.rm1, l, r, (a, b) => a * b);
      case "/":
        return weightOp(this.bindings.rm1, l, r, (a, b) => (b === 0 ? 0 : a / b));
      case "%":
        return weightOp(undefined, l, r, (a, b) => (b === 0 ? 0 : a % b));
      default:
        throw new LiftoscriptSyntaxError(`Unknown operator ${op}`);
    }
  }

  private compareArrays(
    op: ">" | "<" | ">=" | "<=" | "==" | "!=",
    left: (WeightLike | undefined)[],
    right: (WeightLike | undefined)[]
  ): boolean {
    const comparator = (l: WeightLike | undefined, r: WeightLike | undefined): boolean => {
      switch (op) {
        case ">":
          return weightGt(l ?? 0, r ?? 0);
        case "<":
          return weightLt(l ?? 0, r ?? 0);
        case ">=":
          return weightGte(l ?? 0, r ?? 0);
        case "<=":
          return weightLte(l ?? 0, r ?? 0);
        case "==":
          return weightEq(l ?? 0, r ?? 0);
        default:
          return !weightEq(l ?? 0, r ?? 0);
      }
    };
    return left.every((l, i) => comparator(l, right[i]));
  }

  private getArrayBinding(name: string): (WeightLike | undefined)[] | undefined {
    const map: Record<string, keyof Bindings> = {
      originalWeights: "originalWeights",
      weights: "weights",
      reps: "reps",
      minReps: "minReps",
      completedReps: "completedReps",
      completedRepsLeft: "completedRepsLeft",
      completedWeights: "completedWeights",
      timers: "timers",
      setTime: "setTime",
      completedSetTime: "completedSetTime",
      w: "w",
      r: "r",
      cr: "cr",
      cw: "cw",
      mr: "mr",
      completedRPE: "completedRPE",
      bodyweight: "bodyweight",
      RPE: "RPE",
      setVariationIndex: "setVariationIndex",
      exerciseVariationIndex: "exerciseVariationIndex",
      descriptionIndex: "descriptionIndex",
      numberOfSets: "numberOfSets",
      programNumberOfSets: "programNumberOfSets",
      completedNumberOfSets: "completedNumberOfSets",
      amraps: "amraps",
      logrpes: "logrpes",
      askweights: "askweights",
    };
    const key = map[name];
    if (key == null) {
      return undefined;
    }
    const v = this.bindings[key];
    return Array.isArray(v) ? (v as (WeightLike | undefined)[]) : undefined;
  }

  private evalIndex(node: AstNode): number {
    const v = this.evaluate(node);
    const v1 = Array.isArray(v) ? v[0] : v;
    if (weightIs(v1) || weightIsPct(v1)) {
      return v1.value;
    } else if (typeof v1 === "number") {
      return v1;
    } else {
      return v1 ? 1 : 0;
    }
  }

  private evaluateVarExpr(node: { name: string; indexes?: { from?: AstNode; to?: AstNode }[] }): EvalValue {
    const name = node.name;
    if ((node.indexes?.length ?? 0) === 0) {
      let value = this.bindings[name as keyof Bindings];
      if (Array.isArray(value) && name === "minReps") {
        value = value.map((v, i) => (v as number) ?? this.bindings.reps[i]);
      }
      return value as EvalValue;
    }
    const indexExpr = node.indexes![0];
    if (indexExpr.from == null) {
      // handled elsewhere; scalar index or wildcard
      const binding = this.getArrayBinding(name);
      return binding as EvalValue;
    }
    if (indexExpr.to != null) {
      throw new LiftoscriptSyntaxError(`Can't use [1:1] syntax when reading from the ${name} variable`);
    }
    let index = this.evalIndex(indexExpr.from);
    index -= 1;
    const binding = this.getArrayBinding(name);
    if (binding == null) {
      throw new LiftoscriptSyntaxError(`Variable ${name} should be an array`);
    }
    if (index >= binding.length) {
      throw new LiftoscriptSyntaxError(`Out of bounds index ${index + 1} for array ${name}`);
    }
    let value = binding[index];
    if (value == null) {
      if (name === "minReps") {
        value = this.bindings.reps[index] ?? 0;
      } else {
        value = 0;
      }
    }
    return value;
  }

  private evaluateStateVar(node: { key: string; index?: AstNode }): EvalValue {
    let state: IProgramState;
    if (node.index == null) {
      if (node.key in this.state) {
        state = this.state;
      } else {
        throw new LiftoscriptSyntaxError(`There's no state variable '${node.key}'`);
      }
    } else {
      const index = this.evalIndex(node.index);
      state = this.otherStates[index] ?? {};
    }
    if (node.key in state) {
      return state[node.key];
    } else {
      throw new LiftoscriptSyntaxError(`There's no state variable '${node.key}'`);
    }
  }

  private evaluateAssign(node: {
    target: AstNode;
    op: AssignmentOp;
    value: AstNode;
  }): EvalValue {
    const { target, op, value } = node;
    if (target.kind !== "Variable" && target.kind !== "VarExpr" && target.kind !== "StateVar") {
      throw new LiftoscriptSyntaxError("Invalid assignment target");
    }

    // StateVar assignment
    if (target.kind === "StateVar") {
      let state: IProgramState;
      if (target.index == null) {
        if (target.key in this.state) {
          state = this.state;
        } else {
          throw new LiftoscriptSyntaxError(`There's no state variable '${target.key}'`);
        }
      } else {
        const index = this.evalIndex(target.index);
        state = this.otherStates[index] ?? {};
      }
      let v = this.evaluate(value);
      if (!(weightIs(v) || weightIsPct(v) || typeof v === "number")) {
        v = v ? 1 : 0;
      }
      const cur = state[target.key] ?? 0;
      state[target.key] = applyAssignment(cur, v as WeightLike, op, this.bindings.rm1);
      return state[target.key];
    }

    // Variable assignment (var.x) - explicit local variables
    if (target.kind === "Variable" && target.explicit === true) {
      const key = target.name;
      let v = this.evaluate(value);
      if (!(weightIs(v) || weightIsPct(v) || typeof v === "number")) {
        v = v ? 1 : 0;
      }
      const cur = this.vars[key] ?? 0;
      this.vars[key] = applyAssignment(cur, v as WeightLike, op, this.bindings.rm1);
      return this.vars[key];
    }

    // Binding assignment (reps, weights, numberOfSets, rm1, ...). A plain
    // non-explicit keyword (no index) is treated like a scalar binding.
    let varNode: { name: string; indexes?: { from?: AstNode; to?: AstNode }[] };
    if (target.kind === "VarExpr") {
      varNode = target;
    } else {
      varNode = { name: (target as { name: string }).name, indexes: [] };
    }
    const name = varNode.name;
    const indexExprs = varNode.indexes ?? [];
    if (name === "rm1") {
      if (indexExprs.length > 0) {
        throw new LiftoscriptSyntaxError(`rm1 is not an array`);
      }
      let v = this.evaluate(value);
      if (Array.isArray(v)) {
        v = v[0];
      }
      v = v ?? 0;
      v = v === true ? 1 : v === false ? 0 : v;
      const newVal = weightConvertToWeight(this.bindings.rm1, v as WeightLike, this.unit);
      this.bindings.rm1 = newVal;
      return newVal;
    }

    const isPlannerBinding =
      name === "reps" ||
      name === "weights" ||
      name === "RPE" ||
      name === "minReps" ||
      name === "timers" ||
      name === "setTime" ||
      name === "logrpes" ||
      name === "amraps" ||
      name === "askweights" ||
      name === "setVariationIndex" ||
      name === "exerciseVariationIndex" ||
      name === "descriptionIndex" ||
      name === "numberOfSets";

    if (this.mode === "planner" && isPlannerBinding) {
      return this.recordVariableUpdate(name, value, indexExprs, op);
    } else if (this.mode === "update" && name === "numberOfSets") {
      return this.changeNumberOfSets(value, op);
    } else if (
      this.mode === "update" &&
      (name === "reps" ||
        name === "weights" ||
        name === "RPE" ||
        name === "amraps" ||
        name === "logrpes" ||
        name === "askweights" ||
        name === "minReps" ||
        name === "timers" ||
        name === "setTime")
    ) {
      return this.changeBinding(name, value, indexExprs, op);
    } else {
      throw new LiftoscriptSyntaxError(`Unknown variable '${name}'`);
    }
  }

  private calculateIndexValues(indexExprs: { from?: AstNode; to?: AstNode }[]): (number | "*")[] {
    return indexExprs.map((idx) => {
      if (idx.from == null) {
        return "*";
      }
      const v = this.evaluate(idx.from);
      const v1 = Array.isArray(v) ? v[0] : v;
      if (weightIs(v1) || weightIsPct(v1)) {
        return v1.value;
      } else if (typeof v1 === "number") {
        return v1;
      } else {
        return v1 ? 1 : 0;
      }
    });
  }

  private normalizeTarget(target: (number | "*")[], length: number): (number | "*")[] {
    const newTarget = [...target];
    for (let i = 0; i < length - target.length; i += 1) {
      newTarget.unshift("*");
    }
    return newTarget;
  }

  private toNumber(value: EvalValue): number {
    if (typeof value === "number") {
      return value;
    } else if (typeof value === "boolean") {
      return 0;
    } else if (weightIs(value)) {
      return value.value;
    } else if (weightIsPct(value)) {
      return value.value;
    } else if (Array.isArray(value)) {
      return this.toNumber(value[0] ?? 0);
    } else {
      return 0;
    }
  }

  private changeNumberOfSets(expression: AstNode, op: AssignmentOp): number {
    const oldNumberOfSets = this.bindings.weights.length;
    const evaluatedValue = applyNumberOp(this.bindings.numberOfSets, this.toNumber(this.evaluate(expression)), op);

    const b = this.bindings;
    const sliceAll = (arr: unknown[] | undefined) => (arr ? arr.slice(0, evaluatedValue) : arr);
    b.weights = sliceAll(b.weights) as (IWeight | undefined)[];
    b.originalWeights = sliceAll(b.originalWeights) as (IWeight | IPercentage)[];
    b.reps = sliceAll(b.reps) as (number | undefined)[];
    b.minReps = sliceAll(b.minReps) as (number | undefined)[];
    b.RPE = sliceAll(b.RPE) as (number | undefined)[];
    b.w = sliceAll(b.w) as (IWeight | undefined)[];
    b.r = sliceAll(b.r) as (number | undefined)[];
    b.mr = sliceAll(b.mr) as (number | undefined)[];
    b.timers = sliceAll(b.timers) as (number | undefined)[];
    b.setTime = sliceAll(b.setTime) as (number | undefined)[];
    b.amraps = sliceAll(b.amraps) as (number | undefined)[];
    b.logrpes = sliceAll(b.logrpes) as (number | undefined)[];
    b.askweights = sliceAll(b.askweights) as (number | undefined)[];
    b.completedReps = sliceAll(b.completedReps) as (number | undefined)[];
    b.completedRepsLeft = sliceAll(b.completedRepsLeft) as (number | undefined)[];
    b.cr = sliceAll(b.cr) as (number | undefined)[];
    b.cw = sliceAll(b.cw) as (IWeight | undefined)[];
    b.completedWeights = sliceAll(b.completedWeights) as (IWeight | undefined)[];
    b.completedRPE = sliceAll(b.completedRPE) as (number | undefined)[];
    b.isCompleted = sliceAll(b.isCompleted) as number[];

    const ns = oldNumberOfSets - 1;
    for (let i = 0; i < evaluatedValue; i += 1) {
      if (i > ns) {
        const lastWeight = b.weights[ns] ?? weightBuild(0, "lb");
        const lastUnit: Unit = lastWeight.unit === "%" ? "lb" : lastWeight.unit;
        b.weights[i] = weightBuild(lastWeight.value, lastUnit);
        b.reps[i] = b.reps[ns] ?? 0;
        b.timers[i] = b.timers[ns];
        b.setTime[i] = b.setTime[ns];
        b.amraps[i] = b.amraps[ns];
        b.logrpes[i] = b.logrpes[ns];
        b.askweights[i] = b.askweights[ns];
        b.minReps[i] = b.minReps[ns];
        b.RPE[i] = b.RPE[ns];
        b.w[i] = b.weights[i] as IWeight;
        b.r[i] = b.reps[i];
        b.mr[i] = b.minReps[i];
        b.completedReps[i] = undefined;
        b.completedRepsLeft[i] = undefined;
        b.completedWeights[i] = undefined;
        b.completedRPE[i] = undefined;
        b.cr[i] = undefined;
        b.cw[i] = undefined;
        b.isCompleted[i] = 0;
      }
    }
    b.numberOfSets = evaluatedValue;
    b.ns = evaluatedValue;
    return evaluatedValue;
  }

  private changeBinding(
    key: "reps" | "weights" | "RPE" | "minReps" | "timers" | "setTime" | "logrpes" | "amraps" | "askweights",
    expression: AstNode,
    indexExprs: { from?: AstNode; to?: AstNode }[],
    op: AssignmentOp
  ): WeightLike {
    const indexValues = this.calculateIndexValues(indexExprs);
    const maxTargetLength = 1;
    const normalized = this.normalizeTarget(indexValues, maxTargetLength);
    const [setIndex] = normalized;
    let value: WeightLike = 0;

    if (key === "weights") {
      for (let i = 0; i < this.bindings.weights.length; i += 1) {
        if (!this.bindings.isCompleted[i] && (setIndex === "*" || setIndex === i + 1)) {
          const evaluated = this.evaluate(expression);
          const v1 = Array.isArray(evaluated) ? evaluated[0] : evaluated;
          const evaluatedValue: WeightLike =
            weightIs(v1) || weightIsPct(v1) ? v1 : typeof v1 === "number" ? v1 : v1 ? 1 : 0;
          const newValue = weightApplyOp(
            this.bindings.rm1,
            this.bindings.weights[i] ?? weightBuild(0, this.unit),
            evaluatedValue,
            op
          );
          value = weightConvertToWeight(this.bindings.rm1, newValue, this.unit);
          this.bindings.originalWeights[i] = value;
          this.bindings.weights[i] = value;
        }
      }
    } else {
      const keyBindings = this.bindings[key] as (number | undefined)[];
      for (let i = 0; i < keyBindings.length; i += 1) {
        if (!this.bindings.isCompleted[i] && (setIndex === "*" || setIndex === i + 1)) {
          let evaluatedValue = this.toNumber(this.evaluate(expression));
          value = applyNumberOp(keyBindings[i] ?? 0, evaluatedValue, op);
          if (key === "RPE") {
            value = Math.round(Math.min(10, Math.max(0, value)) / 0.5) * 0.5;
          }
          if (key === "amraps" || key === "logrpes" || key === "askweights") {
            value = Math.round(Math.min(1, Math.max(0, value)));
          }
          keyBindings[i] = value;
        }
      }
    }
    return value;
  }

  private recordVariableUpdate(
    key:
      | "reps"
      | "weights"
      | "timers"
      | "setTime"
      | "RPE"
      | "minReps"
      | "setVariationIndex"
      | "exerciseVariationIndex"
      | "descriptionIndex"
      | "numberOfSets"
      | "logrpes"
      | "amraps"
      | "askweights",
    expression: AstNode,
    indexExprs: { from?: AstNode; to?: AstNode }[],
    op: AssignmentOp
  ): WeightLike {
    const indexValues = this.calculateIndexValues(indexExprs);
    const maxTargetLength =
      key === "setVariationIndex" || key === "exerciseVariationIndex" || key === "descriptionIndex"
        ? 2
        : key === "numberOfSets"
          ? 3
          : 4;
    const normalized = this.normalizeTarget(indexValues, maxTargetLength);
    let result: WeightLike;
    if (key === "weights") {
      const v = this.evaluate(expression);
      const v1 = Array.isArray(v) ? v[0] : v;
      result = weightIs(v1) || weightIsPct(v1) ? v1 : typeof v1 === "number" ? v1 : v1 ? 1 : 0;
    } else {
      result = this.toNumber(this.evaluate(expression));
    }
    this.updates.push({ type: key, value: { value: result, op, target: normalized } });
    if (key === "setVariationIndex") {
      const [week, day] = normalized;
      if ((week === "*" || week === this.bindings.week) && (day === "*" || day === this.bindings.day)) {
        this.bindings.setVariationIndex = result as number;
      }
    } else if (key === "exerciseVariationIndex") {
      const [week, day] = normalized;
      if ((week === "*" || week === this.bindings.week) && (day === "*" || day === this.bindings.day)) {
        this.bindings.exerciseVariationIndex = result as number;
      }
    } else if (key === "descriptionIndex") {
      const [week, day] = normalized;
      if ((week === "*" || week === this.bindings.week) && (day === "*" || day === this.bindings.day)) {
        this.bindings.descriptionIndex = result as number;
      }
    } else if (key === "numberOfSets") {
      const [week, day, setVarIndex] = normalized;
      if (
        (week === "*" || week === this.bindings.week) &&
        (day === "*" || day === this.bindings.day) &&
        (setVarIndex === "*" || setVarIndex === this.bindings.setVariationIndex)
      ) {
        this.bindings.numberOfSets = result as number;
        this.bindings.ns = result as number;
      }
    }
    return result;
  }

  private evaluateCall(node: { name: string; args: AstNode[] }): EvalValue {
    const name = node.name as BuiltinName;
    if (!(name in BUILTIN_FNS)) {
      throw new LiftoscriptSyntaxError(`Unknown function '${name}'`);
    }
    const argValues = node.args.map((a) => this.evaluate(a));
    return this.callBuiltin(name, argValues);
  }

  private callBuiltin(name: BuiltinName, args: EvalValue[]): EvalValue {
    const toNum = (v: EvalValue): number => this.toNumber(v);
    const flat = (v: EvalValue): (WeightLike | undefined)[] => {
      if (Array.isArray(v)) {
        return v;
      }
      return [v as WeightLike | undefined];
    };
    switch (name) {
      case "roundWeight":
      case "roundConvertWeight": {
        const v = args[0];
        const v1 = Array.isArray(v) ? v[0] : v;
        if (weightIs(v1)) {
          return weightBuild(Math.round(v1.value * 2) / 2, v1.unit);
        }
        return weightBuild(Math.round((v1 as number) * 2) / 2, this.unit);
      }
      case "calculateTrainingMax":
      case "calculate1RM": {
        const w = args[0];
        const w1 = Array.isArray(w) ? w[0] : w;
        const reps = toNum(args[1]);
        const base = weightIs(w1) ? w1.value : (w1 as number);
        const onerm = base * (1 + reps / 30);
        return weightBuild(Math.round((onerm * 0.9) / 0.005) * 0.005, this.unit);
      }
      case "rpeMultiplier": {
        const reps = toNum(args[0]);
        const rpe = args[1] != null ? toNum(args[1]) : 10;
        return reps + (10 - rpe) * 0.5;
      }
      case "floor": {
        const v = args[0];
        const v1 = Array.isArray(v) ? v[0] : v;
        const f = Math.floor(toNum(v1));
        if (weightIs(v1)) {
          return weightBuild(f, v1.unit);
        } else if (weightIsPct(v1)) {
          return weightBuildPct(f);
        }
        return f;
      }
      case "ceil": {
        const v = args[0];
        const v1 = Array.isArray(v) ? v[0] : v;
        const c = Math.ceil(toNum(v1));
        if (weightIs(v1)) {
          return weightBuild(c, v1.unit);
        } else if (weightIsPct(v1)) {
          return weightBuildPct(c);
        }
        return c;
      }
      case "round": {
        const v = args[0];
        const v1 = Array.isArray(v) ? v[0] : v;
        const r = Math.round(toNum(v1));
        if (weightIs(v1)) {
          return weightBuild(r, v1.unit);
        } else if (weightIsPct(v1)) {
          return weightBuildPct(r);
        }
        return r;
      }
      case "sum": {
        let total: WeightLike = 0;
        for (const a of args) {
          const items = flat(a);
          for (const item of items) {
            if (item == null) {
              continue;
            }
            total = weightOp(this.bindings.rm1, total, item as WeightLike, (x, y) => x + y) as WeightLike;
          }
        }
        return total;
      }
      case "min": {
        let all: (WeightLike | undefined)[] = [];
        for (const a of args) {
          all = all.concat(flat(a));
        }
        const defined = all.filter((x) => x != null) as WeightLike[];
        if (defined.length === 0) {
          return 0;
        }
        let m = defined[0];
        for (const d of defined) {
          if (weightGt(m, d)) {
            m = d;
          }
        }
        return m;
      }
      case "max": {
        let all: (WeightLike | undefined)[] = [];
        for (const a of args) {
          all = all.concat(flat(a));
        }
        const defined = all.filter((x) => x != null) as WeightLike[];
        if (defined.length === 0) {
          return 0;
        }
        let m = defined[0];
        for (const d of defined) {
          if (weightLt(m, d)) {
            m = d;
          }
        }
        return m;
      }
      case "zeroOrGte": {
        const values = flat(args[0]);
        const targets = flat(args[1]);
        for (let i = 0; i < values.length; i += 1) {
          const v = values[i];
          const t = targets[i];
          if ((v == null || v === 0) && t != null && t !== 0) {
            return false;
          }
        }
        return true;
      }
      case "print":
        return args.map((a) => {
          const v = Array.isArray(a) ? a[0] : a;
          return typeof v === "number" ? v : weightPrint(v as WeightLike);
        }) as unknown as EvalValue;
      case "increment": {
        const v = args[0];
        const v1 = Array.isArray(v) ? v[0] : v;
        const inc = Math.round((toNum(v1) + calculateSmallestIncrement(toNum(v1))) * 100) / 100;
        if (weightIs(v1)) {
          return weightBuild(inc, v1.unit);
        } else if (weightIsPct(v1)) {
          return weightBuildPct(inc);
        }
        return inc;
      }
      case "decrement": {
        const v = args[0];
        const v1 = Array.isArray(v) ? v[0] : v;
        const dec = Math.round((toNum(v1) - calculateSmallestIncrement(toNum(v1))) * 100) / 100;
        if (weightIs(v1)) {
          return weightBuild(dec, v1.unit);
        } else if (weightIsPct(v1)) {
          return weightBuildPct(dec);
        }
        return dec;
      }
      case "sets":
        // sets(fromIndex, toIndex, minReps, maxReps, isAmrap, weight, timer, rpe, shouldLogRpe)
        return args.length;
    }
    return 0;
  }
}

function calculateSmallestIncrement(value: number): number {
  if (value >= 100) {
    return value >= 400 ? 10 : 5;
  } else if (value >= 50) {
    return 5;
  } else if (value >= 25) {
    return 2.5;
  } else {
    return 0.5;
  }
}

function applyAssignment(cur: WeightLike, value: WeightLike, op: AssignmentOp, onerm: IWeight): WeightLike {
  if (op === "=") {
    return value;
  }
  return weightApplyOp(onerm, cur, value, op);
}

function applyNumberOp(a: number, b: number, op: AssignmentOp): number {
  switch (op) {
    case "=":
      return b;
    case "+=":
      return a + b;
    case "-=":
      return a - b;
    case "*=":
      return a * b;
    case "/=":
      return b === 0 ? 0 : a / b;
  }
}

/* ------------------------------------------------------------------ */
/* High-level: evaluate a liftoscript snippet                          */
/* ------------------------------------------------------------------ */

export function evaluateLiftoscript(
  script: string,
  opts: {
    state?: IProgramState;
    otherStates?: Record<number, IProgramState>;
    bindings: Bindings;
    unit?: Unit;
    mode?: "planner" | "update";
  }
): { value: EvalValue; updates: LiftoscriptEvaluator["updates"]; bindings: Bindings } {
  const evaluator = new LiftoscriptEvaluator(
    script,
    opts.state ?? {},
    opts.otherStates ?? {},
    opts.bindings,
    opts.unit ?? DEFAULT_UNIT,
    opts.mode ?? "planner"
  );
  const value = evaluator.evaluateAll();
  return { value, updates: evaluator.updates, bindings: opts.bindings };
}

/* ------------------------------------------------------------------ */
/* Exercise block parsers (Obsidian UI use-case)                       */
/* ------------------------------------------------------------------ */

export interface ParsedExerciseSet {
  setNumber: number;
  weight: IWeight;
  reps: number;
  isAmrap: boolean;
  completed: boolean;
  /** char offset into the raw line where this set's completion marker lives */
  markerStart?: number;
  markerEnd?: number;
  /** Hold duration in seconds for timed (stretch) sets. */
  seconds?: number;
  /** Per-set rest in seconds after the hold, from "H|R" stretch syntax. */
  restSeconds?: number;
}

export interface ParsedExercise {
  name: string;
  raw: string;
  /** char offset into the raw line where the exercise spec begins */
  specStart: number;
  sets: ParsedExerciseSet[];
  restSeconds: number;
  isStretch: boolean;
  progress?: {
    type: "lp" | "dp" | "sum" | "custom" | "none";
    args: string[];
    script?: string;
  };
}

const SET_RE =
  /^\s*(\d+)x(\d+)\s*(?:\|\s*(?:(\d+(?:\.\d+)?)\s*(lb|kg)))?\s*([^,|]*)?\s*(?:amount\s*:\s*(\d+))?\s*(?:,\s*(\d+)\s*(?:m|s|:))?/i;

/**
 * Parse a single liftoscript exercise line.
 *
 * Supporting format:
 *   [x] [ ] [x] Exercise Name / 3x8 100lb, rest: 60, progress: lp(5lb)
 *
 * Leading "[ ]"/"[x]" markers, if present, are consumed in order and bound to
 * each set, recording their character offsets so the caller can round-trip a
 * checkbox toggle back into the raw text.
 */
export function parseExerciseLine(line: string, setStart = 1): ParsedExercise {
  const trimmed = line.trim();
  const lineOffset = line.indexOf(trimmed);

  // Parse leading completion markers "[ ]" / "[x]"
  let cursor = 0;
  const markers: { start: number; end: number; completed: boolean }[] = [];
  const markerRe = /\[([ xX])\]/g;
  // only consume markers before the first "/"
  const dashIndexOriginal = trimmed.indexOf("/");
  const markerZone = dashIndexOriginal === -1 ? trimmed : trimmed.substring(0, dashIndexOriginal);
  let mm: RegExpExecArray | null;
  let markerEndOffset = 0;
  while ((mm = markerRe.exec(markerZone))) {
    markers.push({
      start: lineOffset + mm.index,
      end: lineOffset + mm.index + 3,
      completed: mm[1] !== " ",
    });
    markerEndOffset = lineOffset + mm.index + 3;
  }

  // Determine the raw-line offset where the exercise spec starts (just past
  // the completion markers), then trim leading whitespace.
  const rawSpecStart = markers.length > 0 ? markerEndOffset : lineOffset;
  const rawSpec = line.substring(rawSpecStart);
  const specTrim = rawSpec.replace(/^\s*/, "");
  const specStart = rawSpecStart + (rawSpec.length - specTrim.length);
  const spec = specTrim;

  const dashIndex = spec.indexOf("/");
  const name = (dashIndex === -1 ? spec : spec.substring(0, dashIndex)).trim();
  const rest = dashIndex === -1 ? "" : spec.substring(dashIndex + 1);

  const restMatch = rest.match(/rest\s*:\s*(\d+)/i);
  const restSeconds = restMatch ? parseInt(restMatch[1], 10) : 0;

  let progress: ParsedExercise["progress"];

  const lpMatch = rest.match(/progress\s*:\s*lp\s*\(\s*([^)]*)\)/i);
  if (lpMatch) {
    const args = lpMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
    progress = { type: "lp", args };
  } else {
    const dpMatch = rest.match(/progress\s*:\s*dp\s*\(\s*([^)]*)\)/i);
    if (dpMatch) {
      const args = dpMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
      progress = { type: "dp", args };
    } else {
      const sumMatch = rest.match(/progress\s*:\s*sum\s*\(\s*([^)]*)\)/i);
      if (sumMatch) {
        const args = sumMatch[1].split(",").map((a) => a.trim()).filter(Boolean);
        progress = { type: "sum", args };
      } else {
        const customMatch = rest.match(/progress\s*:\s*custom\s*\(([^)]*)\)\s*(?:\{([\s\S]*)\})?/i);
        if (customMatch) {
          progress = { type: "custom", args: [], script: customMatch[2] };
        } else if (/progress\s*:\s*none/i.test(rest)) {
          progress = { type: "none", args: [] };
        }
      }
    }
  }

  // Stretch exercises are categorized via a "type: stretch" tag on the line or
  // via a "stretch" entry in the exercise database.
  const isStretch = STRETCH_TAG_RE.test(spec) || isStretchExerciseName(name);

  // Parse set tokens. Strength lines use "5x100lb" style tokens, where each
  // token is ONE set of <reps>x<weight>. Stretch lines use time-based specs
  // like "3x60s" (3 sets of 60s) and may carry a per-set rest via "60s|30s",
  // and they ignore weight and rep counts entirely.
  const sets: ParsedExerciseSet[] = [];
  let setNumber = setStart;
  if (isStretch) {
    const stretchTokenRe = /(?:(\d+)x)?(\d+(?:\.\d+)?)s(?:\|(\d+(?:\.\d+)?)s)?/gi;
    let sm: RegExpExecArray | null;
    while ((sm = stretchTokenRe.exec(rest))) {
      const count = sm[1] ? parseInt(sm[1], 10) : 1;
      const holdSeconds = parseFloat(sm[2]);
      const stretchRest = sm[3] ? parseFloat(sm[3]) : undefined;
      for (let i = 0; i < count; i++) {
        const marker = markers[sets.length];
        sets.push({
          setNumber,
          weight: weightBuild(0, DEFAULT_UNIT),
          reps: 0,
          isAmrap: false,
          completed: marker ? marker.completed : false,
          markerStart: marker?.start,
          markerEnd: marker?.end,
          seconds: holdSeconds,
          restSeconds: stretchRest,
        });
        setNumber += 1;
      }
    }
  }

  if (sets.length === 0) {
    const setTokenRe = /(\d+)x(\d+(?:\.\d+)?)\s*(lb|kg)/g;
    let m: RegExpExecArray | null;
    while ((m = setTokenRe.exec(rest))) {
      const reps = parseInt(m[1], 10);
      const weightValue = parseFloat(m[2]);
      const unit = m[3] as Unit;
      const marker = markers[sets.length];
      sets.push({
        setNumber,
        weight: weightBuild(weightValue, unit),
        reps,
        isAmrap: false,
        completed: marker ? marker.completed : false,
        markerStart: marker?.start,
        markerEnd: marker?.end,
      });
      setNumber += 1;
    }
  }

  return {
    name,
    raw: line,
    specStart,
    sets,
    restSeconds,
    isStretch,
    progress,
  };
}

/**
 * Toggle the completion marker for a given set within an exercise line and
 * return the updated line string.
 */
export function setSetCompleted(line: string, setRecord: ParsedExerciseSet, completed: boolean): string {
  if (setRecord.markerStart == null || setRecord.markerEnd == null) {
    // No marker present; nothing to update without a target offset.
    return line;
  }
  const markerText = completed ? "[x]" : "[ ]";
  return (
    line.substring(0, setRecord.markerStart) +
    markerText +
    line.substring(setRecord.markerEnd)
  );
}

/* ------------------------------------------------------------------ */
/* Linear progression (P11): compute next-session values from lp()     */
/* ------------------------------------------------------------------ */

export interface LinearProgressionResult {
  increment: IWeight;
  incrementPerformed: boolean;
  decrement: IWeight;
  decrementPerformed: boolean;
  successCounter: number;
  failureCounter: number;
}

/**
 * Mirrors Liftosaur's buildProgress("lp") script semantics for a single
 * exercise whose completed sets are supplied.
 */
export function applyLinearProgression(
  progressArgs: string[],
  completed: {
    totalReps: number;
    requiredReps: number;
    minReps?: number;
    weights: IWeight[];
  },
  opts?: { unit?: Unit }
): LinearProgressionResult {
  const unit = opts?.unit ?? DEFAULT_UNIT;
  const parseInc = (s: string | undefined): IWeight | IPercentage => {
    if (!s) {
      return weightBuild(0, unit);
    }
    if (s.endsWith("%")) {
      return weightBuildPct(parseFloat(s));
    }
    const v = s.endsWith("lb") || s.endsWith("kg") ? parseFloat(s) : parseFloat(s);
    const u = (s.endsWith("kg") ? "kg" : "lb") as Unit;
    return weightBuild(v, u);
  };

  const increment = parseInc(progressArgs[0]) as IWeight;
  const successes = progressArgs[1] ? parseInt(progressArgs[1], 10) : 1;
  let successCounter = progressArgs[2] ? parseInt(progressArgs[2], 10) : 0;
  const decrementRaw = parseInc(progressArgs[3]);
  const decrement = weightIsPct(decrementRaw) ? weightBuild(0, unit) : (decrementRaw as IWeight);
  const failures = progressArgs[4] ? parseInt(progressArgs[4], 10) : (decrement.value ?? 0) > 0 ? 1 : 0;
  let failureCounter = progressArgs[5] ? parseInt(progressArgs[5], 10) : 0;

  let incrementPerformed = false;
  let decrementPerformed = false;

  const onerm = completed.weights[0] ?? weightBuild(0, unit);

  if (completed.totalReps >= completed.requiredReps) {
    successCounter += 1;
    if (successCounter >= successes) {
      incrementPerformed = true;
      successCounter = 0;
      failureCounter = 0;
    }
  } else {
    const minReps = completed.minReps ?? completed.requiredReps;
    if (decrement.value > 0 && failures > 0 && !(completed.totalReps >= minReps)) {
      failureCounter += 1;
      if (failureCounter >= failures) {
        decrementPerformed = true;
        failureCounter = 0;
        successCounter = 0;
      }
    }
  }

  return {
    increment,
    incrementPerformed,
    decrement,
    decrementPerformed,
    successCounter,
    failureCounter,
  };
}

export function weightAddIncrement(weight: IWeight, increment: IWeight): IWeight {
  return weightOperation(weight, increment, (a, b) => a + b);
}
