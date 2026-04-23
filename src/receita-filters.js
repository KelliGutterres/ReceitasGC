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

module.exports = {
  normalizeReceitaListFilters,
  buildReceitaListWhere,
};
