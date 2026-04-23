const TIPOS_RECEITA = ["doce", "salgada"];

function normalizeReceitaListFilters(query) {
  let tipo_receita = String(query.tipo_receita || "").trim();
  if (tipo_receita && !TIPOS_RECEITA.includes(tipo_receita)) tipo_receita = "";
  const raw = String(query.data_criacao || query.data_inicio || "").trim();
  const data_criacao = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  return { tipo_receita, data_criacao };
}

function buildReceitaListWhere(filters) {
  const conditions = [];
  const params = [];
  let i = 1;
  if (filters.tipo_receita) {
    conditions.push(`tipo_receita = $${i}`);
    params.push(filters.tipo_receita);
    i += 1;
  }
  if (filters.data_criacao) {
    conditions.push(`data_registro = $${i}`);
    params.push(filters.data_criacao);
    i += 1;
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

function buildPdfExportHref(filters) {
  const parts = [];
  if (filters.tipo_receita) parts.push(`tipo_receita=${encodeURIComponent(filters.tipo_receita)}`);
  if (filters.data_criacao) parts.push(`data_criacao=${encodeURIComponent(filters.data_criacao)}`);
  return `/receitas/exportar-pdf${parts.length ? `?${parts.join("&")}` : ""}`;
}

function formatDatePdf(value) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

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
  normalizeReceitaListFilters,
  buildReceitaListWhere,
  buildPdfExportHref,
  formatDatePdf,
  formatDateBR,
  parseReceitaBody,
  parseCusto,
  toDateInputValue,
  custoDisplayFromDb,
};
