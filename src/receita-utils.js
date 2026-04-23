function formatDateBR(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseReceitaBody(body) {
  return {
    nome: String(body.nome || "").trim(),
    descricao: String(body.descricao || "").trim(),
    data_registro: String(body.data_registro || "").trim(),
    custo: String(body.custo || "").trim(),
    tipo_receita: String(body.tipo_receita || "").trim(),
  };
}

function parseCusto(str) {
  const n = parseFloat(String(str).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function toDateInputValue(d) {
  if (!d) return "";
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const x = new Date(s);
    if (!Number.isNaN(x.getTime())) return x.toISOString().slice(0, 10);
  } catch (_) {
    /* ignore */
  }
  return "";
}

function custoDisplayFromDb(custo) {
  return Number(custo).toFixed(2).replace(".", ",");
}

module.exports = {
  formatDateBR,
  parseReceitaBody,
  parseCusto,
  toDateInputValue,
  custoDisplayFromDb,
};
