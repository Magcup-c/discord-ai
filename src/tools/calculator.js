function tokenize(input) {
  if (typeof input !== "string" || input.length > 200) throw new Error("Invalid expression");
  const tokens = input.match(/\s*(?:\d+(?:\.\d*)?|\.\d+|[()+\-*/%^])\s*/g);
  if (!tokens || tokens.join("").replace(/\s/g, "") !== input.replace(/\s/g, "")) {
    throw new Error("式に使用できない文字があります");
  }
  return tokens.map(token => token.trim()).filter(Boolean);
}

export function calculate({ expression }) {
  const tokens = tokenize(expression);
  let position = 0;
  const peek = () => tokens[position];
  const take = () => tokens[position++];

  function primary() {
    if (peek() === "+") { take(); return primary(); }
    if (peek() === "-") { take(); return -primary(); }
    if (peek() === "(") {
      take();
      const value = addSub();
      if (take() !== ")") throw new Error("括弧が対応していません");
      return value;
    }
    const token = take();
    if (!token || !/^\d*\.?\d+$/.test(token)) throw new Error("数値が必要です");
    return Number(token);
  }
  function power() {
    const left = primary();
    if (peek() === "^") { take(); return left ** power(); }
    return left;
  }
  function mulDiv() {
    let value = power();
    while (["*", "/", "%"].includes(peek())) {
      const op = take();
      const right = power();
      if ((op === "/" || op === "%") && right === 0) throw new Error("0で割ることはできません");
      value = op === "*" ? value * right : op === "/" ? value / right : value % right;
    }
    return value;
  }
  function addSub() {
    let value = mulDiv();
    while (peek() === "+" || peek() === "-") {
      const op = take();
      const right = mulDiv();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = addSub();
  if (position !== tokens.length || !Number.isFinite(result)) throw new Error("計算できない式です");
  return { expression, result };
}
