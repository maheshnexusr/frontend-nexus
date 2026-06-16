/**
 * formulaEngine — pure, no-React expression engine for the Formula field type.
 *
 * Grammar (Phase 1):
 *   expr     := or
 *   or       := and ( 'OR' and )*
 *   and      := compare ( 'AND' compare )*
 *   compare  := add ( ('=='|'!='|'>'|'<'|'>='|'<=') add )*
 *   add      := mul ( ('+'|'-') mul )*
 *   mul      := unary ( ('*'|'/') unary )*
 *   unary    := '-' unary | primary
 *   primary  := number | string | boolean | ident | func '(' args ')' | '(' expr ')'
 *
 * Fields are referenced by their Internal Field Name (fieldKey) as bare
 * identifiers: e.g. `price * quantity`. Functions: IF, SUM, AVG, MIN, MAX, ROUND.
 *
 * Everything here is synchronous and side-effect free so it can be unit-tested
 * in Node and reused by the builder UI, the design preview, and the runtime.
 */

export const FUNCTIONS = ['IF', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'POWER', 'DATEDIFF', 'TODAY'];
const KEYWORDS = ['AND', 'OR', 'TRUE', 'FALSE'];
const FUNC_SET = new Set(FUNCTIONS);
const KW_SET = new Set(KEYWORDS);

/* ── Tokenizer ──────────────────────────────────────────────────────────── */
// Token: { type, value }  type ∈ num|str|bool|ident|func|op|lparen|rparen|comma
export function tokenize(expr) {
  const src = String(expr ?? '');
  const tokens = [];
  let i = 0;
  const isIdentStart = (c) => /[A-Za-z_]/.test(c);
  const isIdentPart = (c) => /[A-Za-z0-9_]/.test(c);

  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i += 1; continue; }

    // Number
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1;
      const text = src.slice(i, j);
      if ((text.match(/\./g) || []).length > 1) return { error: { message: `Invalid number '${text}'` } };
      tokens.push({ type: 'num', value: Number(text) });
      i = j; continue;
    }

    // String (double-quoted)
    if (c === '"') {
      let j = i + 1; let str = '';
      while (j < src.length && src[j] !== '"') { str += src[j]; j += 1; }
      if (j >= src.length) return { error: { message: 'Unterminated string literal' } };
      tokens.push({ type: 'str', value: str });
      i = j + 1; continue;
    }

    // Identifier / keyword / function / boolean
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < src.length && isIdentPart(src[j])) j += 1;
      const word = src.slice(i, j);
      const upper = word.toUpperCase();
      if (upper === 'AND' || upper === 'OR') tokens.push({ type: 'op', value: upper });
      else if (upper === 'TRUE' || upper === 'FALSE') tokens.push({ type: 'bool', value: upper === 'TRUE' });
      else if (FUNC_SET.has(upper)) tokens.push({ type: 'func', value: upper });
      else tokens.push({ type: 'ident', value: word });
      i = j; continue;
    }

    // Two-char operators
    const two = src.slice(i, i + 2);
    if (two === '==' || two === '!=' || two === '>=' || two === '<=') {
      tokens.push({ type: 'op', value: two }); i += 2; continue;
    }

    // Single-char
    if ('+-*/'.includes(c)) { tokens.push({ type: 'op', value: c }); i += 1; continue; }
    if (c === '>' || c === '<') { tokens.push({ type: 'op', value: c }); i += 1; continue; }
    if (c === '(') { tokens.push({ type: 'lparen', value: '(' }); i += 1; continue; }
    if (c === ')') { tokens.push({ type: 'rparen', value: ')' }); i += 1; continue; }
    if (c === ',') { tokens.push({ type: 'comma', value: ',' }); i += 1; continue; }
    if (c === '=') return { error: { message: "Unexpected token '=' (use '==' for comparison)" } };

    return { error: { message: `Unexpected character '${c}'` } };
  }
  return { tokens };
}

/* ── Parser (recursive descent → AST) ───────────────────────────────────── */
// AST nodes: {t:'num'|'str'|'bool', v} | {t:'field', name} |
//   {t:'bin', op, l, r} | {t:'unary', op, e} | {t:'call', name, args:[]}
export function parse(expr) {
  if (!String(expr ?? '').trim()) return { error: { message: 'Formula cannot be empty' } };
  const tk = tokenize(expr);
  if (tk.error) return { error: tk.error };
  const toks = tk.tokens;
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const tokenLabel = (t) => (t == null ? 'end of formula' : `'${t.value}'`);

  let error = null;
  const fail = (msg) => { if (!error) error = { message: msg }; return { t: 'num', v: 0 }; };

  function parseExpr() { return parseOr(); }

  function parseOr() {
    let node = parseAnd();
    while (peek() && peek().type === 'op' && peek().value === 'OR') { next(); node = { t: 'bin', op: 'OR', l: node, r: parseAnd() }; }
    return node;
  }
  function parseAnd() {
    let node = parseCompare();
    while (peek() && peek().type === 'op' && peek().value === 'AND') { next(); node = { t: 'bin', op: 'AND', l: node, r: parseCompare() }; }
    return node;
  }
  function parseCompare() {
    let node = parseAdd();
    while (peek() && peek().type === 'op' && ['==', '!=', '>', '<', '>=', '<='].includes(peek().value)) {
      const op = next().value; node = { t: 'bin', op, l: node, r: parseAdd() };
    }
    return node;
  }
  function parseAdd() {
    let node = parseMul();
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = next().value; node = { t: 'bin', op, l: node, r: parseMul() };
    }
    return node;
  }
  function parseMul() {
    let node = parseUnary();
    while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = next().value; node = { t: 'bin', op, l: node, r: parseUnary() };
    }
    return node;
  }
  function parseUnary() {
    if (peek() && peek().type === 'op' && peek().value === '-') { next(); return { t: 'unary', op: '-', e: parseUnary() }; }
    return parsePrimary();
  }
  function parsePrimary() {
    const t = peek();
    if (!t) return fail('Unexpected end of formula');
    if (t.type === 'num')  { next(); return { t: 'num', v: t.value }; }
    if (t.type === 'str')  { next(); return { t: 'str', v: t.value }; }
    if (t.type === 'bool') { next(); return { t: 'bool', v: t.value }; }
    if (t.type === 'ident') {
      next();
      // An identifier immediately followed by '(' is an attempted function call
      // with an unknown name (real functions tokenize as `func`).
      if (peek() && peek().type === 'lparen') return fail(`Function '${t.value}' is not supported`);
      return { t: 'field', name: t.value };
    }
    if (t.type === 'func') {
      const name = next().value;
      if (!peek() || peek().type !== 'lparen') return fail(`Expected '(' after ${name}`);
      next(); // (
      const args = [];
      if (peek() && peek().type !== 'rparen') {
        args.push(parseExpr());
        while (peek() && peek().type === 'comma') { next(); args.push(parseExpr()); }
      }
      if (!peek() || peek().type !== 'rparen') return fail(`Expected ')' to close ${name}(`);
      next(); // )
      return { t: 'call', name, args };
    }
    if (t.type === 'lparen') {
      next();
      const node = parseExpr();
      if (!peek() || peek().type !== 'rparen') return fail("Expected ')'");
      next();
      return node;
    }
    return fail(`Unexpected token ${tokenLabel(t)}`);
  }

  const ast = parseExpr();
  if (error) return { error };
  if (pos < toks.length) return { error: { message: `Unexpected token ${tokenLabel(peek())}` } };
  return { ast };
}

/* ── Dependency extraction ──────────────────────────────────────────────── */
// All distinct field identifiers referenced by the expression (parse-based, so
// strings / function names / keywords are excluded). Returns [] on parse error.
export function extractDependencies(expr) {
  const { ast, error } = parse(expr);
  if (error || !ast) return [];
  const out = new Set();
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.t === 'field') out.add(n.name);
    else if (n.t === 'bin') { walk(n.l); walk(n.r); }
    else if (n.t === 'unary') walk(n.e);
    else if (n.t === 'call') n.args.forEach(walk);
  })(ast);
  return [...out];
}

/* ── Evaluator ──────────────────────────────────────────────────────────── */
const num = (v) => {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === '' || v == null) return 0;
  const n = Number(String(v).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
// Today's date as ISO 'YYYY-MM-DD' (used by TODAY(), feeds DATEDIFF/toDate).
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Parse a date value (ISO 'YYYY-MM-DD', datetime, or any Date-parseable string)
// to a millisecond timestamp at UTC midnight, or null when not a valid date.
const toDate = (v) => {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  const str = String(v).trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
  const t = Date.parse(str);
  return Number.isNaN(t) ? null : t;
};

const truthy = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v == null) return false;
  return String(v).trim() !== '';
};

export function evaluate(ast, scope = {}) {
  const ev = (n) => {
    switch (n.t) {
      case 'num': case 'str': case 'bool': return n.v;
      case 'field': return scope[n.name];
      case 'unary': return -num(ev(n.e));
      case 'bin': return evalBin(n.op, n.l, n.r, ev);
      case 'call': return evalCall(n.name, n.args.map(ev));
      default: return null;
    }
  };
  return ev(ast);
}

function evalBin(op, lNode, rNode, ev) {
  if (op === 'AND') return truthy(ev(lNode)) && truthy(ev(rNode));
  if (op === 'OR')  return truthy(ev(lNode)) || truthy(ev(rNode));
  const l = ev(lNode), r = ev(rNode);
  switch (op) {
    case '+': {
      // String concatenation when either side is a non-numeric string.
      if (typeof l === 'string' || typeof r === 'string') {
        const ln = Number(l), rn = Number(r);
        if (Number.isNaN(ln) || Number.isNaN(rn)) return `${l ?? ''}${r ?? ''}`;
      }
      return num(l) + num(r);
    }
    case '-': return num(l) - num(r);
    case '*': return num(l) * num(r);
    case '/': { const d = num(r); return d === 0 ? null : num(l) / d; }
    case '==': return looseEq(l, r);
    case '!=': return !looseEq(l, r);
    case '>':  return num(l) > num(r);
    case '<':  return num(l) < num(r);
    case '>=': return num(l) >= num(r);
    case '<=': return num(l) <= num(r);
    default:   return null;
  }
}

function looseEq(l, r) {
  if (typeof l === 'string' || typeof r === 'string') {
    const ln = Number(l), rn = Number(r);
    if (!Number.isNaN(ln) && !Number.isNaN(rn) && l !== '' && r !== '') return ln === rn;
    return String(l ?? '') === String(r ?? '');
  }
  return num(l) === num(r);
}

function evalCall(name, args) {
  switch (name) {
    case 'IF':    return truthy(args[0]) ? args[1] : args[2];
    case 'SUM':   return args.reduce((a, b) => a + num(b), 0);
    case 'AVG':   return args.length ? args.reduce((a, b) => a + num(b), 0) / args.length : 0;
    case 'MIN':   return args.length ? Math.min(...args.map(num)) : 0;
    case 'MAX':   return args.length ? Math.max(...args.map(num)) : 0;
    case 'ROUND': { const f = 10 ** (args[1] == null ? 0 : num(args[1])); return Math.round(num(args[0]) * f) / f; }
    case 'POWER': return num(args[0]) ** num(args[1]);
    case 'TODAY': return todayISO();
    case 'DATEDIFF': { // DATEDIFF(later, earlier [, "days"|"months"|"years"])
      const a = toDate(args[0]); const b = toDate(args[1]);
      if (a == null || b == null) return null;
      const unit = (args[2] == null ? 'days' : String(args[2]).toLowerCase());
      if (unit === 'days') return Math.round((a - b) / 86400000);
      const da = new Date(a); const db = new Date(b);
      let months = (da.getUTCFullYear() - db.getUTCFullYear()) * 12 + (da.getUTCMonth() - db.getUTCMonth());
      if (da.getUTCDate() < db.getUTCDate()) months -= 1;   // not yet a full month
      if (unit === 'months') return months;
      if (unit === 'years') return Math.trunc(months / 12);
      return Math.round((a - b) / 86400000);
    }
    default:      return null;
  }
}

// Convenience: parse + evaluate in one call. Returns { value, error }.
export function evaluateExpression(expr, scope = {}) {
  const { ast, error } = parse(expr);
  if (error) return { value: null, error };
  try { return { value: evaluate(ast, scope), error: null }; }
  catch (e) { return { value: null, error: { message: e.message || 'Evaluation error' } }; }
}

/* ── Output coercion ────────────────────────────────────────────────────── */
export function coerceOutput(value, outputType = 'number', precision = 2) {
  if (value == null) return outputType === 'text' ? '' : null;
  switch (outputType) {
    case 'text':    return typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
    case 'boolean': return truthy(value);
    case 'number':
    default: {
      const n = num(value);
      const p = Number(precision);
      if (!Number.isFinite(p) || p < 0) return n;
      const f = 10 ** p;
      return Math.round(n * f) / f;
    }
  }
}

/* ── Function arity check ───────────────────────────────────────────────── */
const ARITY = { IF: [3, 3], ROUND: [1, 2], POWER: [2, 2], TODAY: [0, 0], DATEDIFF: [2, 3], SUM: [1, Infinity], AVG: [1, Infinity], MIN: [1, Infinity], MAX: [1, Infinity] };
function checkArity(ast) {
  let err = null;
  (function walk(n) {
    if (err || !n || typeof n !== 'object') return;
    if (n.t === 'call') {
      const [min, max] = ARITY[n.name] || [0, Infinity];
      if (n.args.length < min || n.args.length > max) {
        err = max === Infinity
          ? `${n.name} expects at least ${min} argument${min !== 1 ? 's' : ''}`
          : min === max
            ? `${n.name} expects ${min} argument${min !== 1 ? 's' : ''}`
            : `${n.name} expects ${min}–${max} arguments`;
      }
      n.args.forEach(walk);
    } else if (n.t === 'bin') { walk(n.l); walk(n.r); }
    else if (n.t === 'unary') walk(n.e);
  })(ast);
  return err;
}

/* ── Validation ─────────────────────────────────────────────────────────── */
/**
 * Validate an expression. `fieldKeys` = Set/array of valid field internal names
 * (exclude the formula's own key). Returns { valid, error, dependencies }.
 */
export function validateFormula(expr, { fieldKeys = [] } = {}) {
  if (!String(expr ?? '').trim()) return { valid: false, error: 'Formula cannot be empty', dependencies: [] };
  const { ast, error } = parse(expr);
  if (error) return { valid: false, error: error.message, dependencies: [] };

  const keySet = fieldKeys instanceof Set ? fieldKeys : new Set(fieldKeys);
  const deps = extractDependencies(expr);
  const missing = deps.find((d) => !keySet.has(d));
  if (missing) return { valid: false, error: `Field '${missing}' does not exist`, dependencies: deps };

  const arityErr = checkArity(ast);
  if (arityErr) return { valid: false, error: arityErr, dependencies: deps };

  return { valid: true, error: null, dependencies: deps };
}

/* ── Circular reference detection ───────────────────────────────────────── */
/**
 * Given all formula fields [{ fieldKey, expression }], build the dependency
 * graph restricted to formula→formula edges and detect any cycle via DFS.
 * Returns { cycle:[fieldKeys] } or null.
 */
export function detectCircular(formulaFields = []) {
  const byKey = new Map();
  formulaFields.forEach((f) => { if (f.fieldKey) byKey.set(f.fieldKey, f); });
  const edges = new Map();
  byKey.forEach((f, key) => {
    const deps = extractDependencies(f.expression).filter((d) => byKey.has(d));
    edges.set(key, deps);
  });

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...byKey.keys()].map((k) => [k, WHITE]));
  const stack = [];
  let cycle = null;

  const dfs = (node) => {
    color.set(node, GRAY); stack.push(node);
    for (const dep of edges.get(node) || []) {
      if (cycle) return;
      if (color.get(dep) === GRAY) { const i = stack.indexOf(dep); cycle = [...stack.slice(i), dep]; return; }
      if (color.get(dep) === WHITE) dfs(dep);
    }
    color.set(node, BLACK); stack.pop();
  };
  for (const key of byKey.keys()) { if (cycle) break; if (color.get(key) === WHITE) dfs(key); }
  return cycle ? { cycle } : null;
}
