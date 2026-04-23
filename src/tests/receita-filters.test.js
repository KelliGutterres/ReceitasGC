const { normalizeReceitaListFilters, buildReceitaListWhere } = require("../receita-filters");

describe("normalizeReceitaListFilters", () => {
  test("01. retorna tipo e data vazios quando não há query string", () => {
    expect(normalizeReceitaListFilters({})).toEqual({ tipo_receita: "", data_criacao: "" });
  });

  test("02. mantém tipo_receita doce quando o valor é permitido", () => {
    expect(normalizeReceitaListFilters({ tipo_receita: "doce" })).toEqual({
      tipo_receita: "doce",
      data_criacao: "",
    });
  });

  test("03. zera tipo_receita quando o valor não é doce nem salgada", () => {
    expect(normalizeReceitaListFilters({ tipo_receita: "doce_doce" }).tipo_receita).toBe("");
  });

  test("04. aceita data_criacao somente no formato YYYY-MM-DD", () => {
    expect(normalizeReceitaListFilters({ data_criacao: "2025-04-10" })).toEqual({
      tipo_receita: "",
      data_criacao: "2025-04-10",
    });
  });

  test("05. usa data_inicio como alias quando data_criacao não veio na query", () => {
    expect(normalizeReceitaListFilters({ data_inicio: "2024-01-02" }).data_criacao).toBe("2024-01-02");
  });

  test("06. ignora data em formato que não seja ano-mês-dia", () => {
    expect(normalizeReceitaListFilters({ data_criacao: "10-04-2025" }).data_criacao).toBe("");
  });

  test("07. remove espaços no início e no fim do tipo para não quebrar o filtro na UI", () => {
    expect(normalizeReceitaListFilters({ tipo_receita: "  doce  " })).toEqual({
      tipo_receita: "doce",
      data_criacao: "",
    });
  });

  test("08. prioriza data_criacao se data_inicio e data_criacao vierem juntos", () => {
    const r = normalizeReceitaListFilters({
      data_criacao: "2025-01-10",
      data_inicio: "2024-12-01",
    });
    expect(r.data_criacao).toBe("2025-01-10");
  });
});

describe("buildReceitaListWhere", () => {
  test("09. não gera WHERE nem parâmetros quando os filtros estão vazios", () => {
    const r = buildReceitaListWhere({ tipo_receita: "", data_criacao: "" });
    expect(r.where).toBe("");
    expect(r.params).toEqual([]);
  });

  test("10. gera condição apenas por tipo_receita (salgada)", () => {
    const r = buildReceitaListWhere({ tipo_receita: "salgada", data_criacao: "" });
    expect(r.where).toBe("WHERE tipo_receita = $1");
    expect(r.params).toEqual(["salgada"]);
  });

  test("11. gera condição apenas por igualdade em data_registro", () => {
    const r = buildReceitaListWhere({ tipo_receita: "", data_criacao: "2025-01-01" });
    expect(r.where).toBe("WHERE data_registro = $1");
    expect(r.params).toEqual(["2025-01-01"]);
  });

  test("12. combina tipo e data com placeholders $1 e $2 na ordem correta", () => {
    const r = buildReceitaListWhere({ tipo_receita: "doce", data_criacao: "2025-06-15" });
    expect(r.where).toBe("WHERE tipo_receita = $1 AND data_registro = $2");
    expect(r.params).toEqual(["doce", "2025-06-15"]);
  });

  test("13. mantém valores só em params (nada concatenado no texto do WHERE)", () => {
    const q = { tipo_receita: "doce", data_criacao: "2025-03-01" };
    const f = normalizeReceitaListFilters(q);
    const { where, params } = buildReceitaListWhere(f);
    expect(where).not.toMatch(/doce|2025-03-01/);
    expect(where).toMatch(/\$1/);
    expect(where).toMatch(/\$2/);
    expect(params).toEqual(["doce", "2025-03-01"]);
  });
});
