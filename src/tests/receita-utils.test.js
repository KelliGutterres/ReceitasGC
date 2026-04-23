const {
  normalizeReceitaListFilters,
  buildReceitaListWhere,
  buildPdfExportHref,
  parseReceitaBody,
  parseCusto,
  toDateInputValue,
  custoDisplayFromDb,
  formatDateBR,
  formatDatePdf,
} = require("../receita-utils");

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

describe("buildPdfExportHref", () => {
  test("14. retorna só o path do export quando não há filtros ativos", () => {
    expect(buildPdfExportHref({ tipo_receita: "", data_criacao: "" })).toBe("/receitas/exportar-pdf");
  });

  test("15. acrescenta tipo_receita na query string do PDF", () => {
    const href = buildPdfExportHref({ tipo_receita: "salgada", data_criacao: "" });
    expect(href).toBe("/receitas/exportar-pdf?tipo_receita=salgada");
  });

  test("16. reproduz na URL do PDF o mesmo filtro de tipo e data da listagem", () => {
    const href = buildPdfExportHref({ tipo_receita: "doce", data_criacao: "2025-12-25" });
    expect(href).toContain("tipo_receita=doce");
    expect(href).toContain("data_criacao=2025-12-25");
    expect(href.startsWith("/receitas/exportar-pdf?")).toBe(true);
  });
});

describe("parseReceitaBody", () => {
  test("17. remove espaços no início e no fim de todos os campos e normaliza as strings", () => {
    const v = parseReceitaBody({
      nome: "  Bolo  ",
      descricao: " chocolate ",
      data_registro: "2025-01-01",
      custo: "10",
      tipo_receita: "doce",
    });
    expect(v).toEqual({
      nome: "Bolo",
      descricao: "chocolate",
      data_registro: "2025-01-01",
      custo: "10",
      tipo_receita: "doce",
    });
  });

  test("18. preenche com string vazia quando o body veio vazio", () => {
    const v = parseReceitaBody({});
    expect(v.nome).toBe("");
    expect(v.descricao).toBe("");
    expect(v.data_registro).toBe("");
    expect(v.custo).toBe("");
    expect(v.tipo_receita).toBe("");
  });
});

describe("parseCusto", () => {
  test("19. interpreta vírgula como separador decimal (pt-BR)", () => {
    expect(parseCusto("12,5")).toBe(12.5);
  });

  test("20. retorna null para custo negativo", () => {
    expect(parseCusto("-0,01")).toBeNull();
  });

  test("21. retorna null quando não há número parseável", () => {
    expect(parseCusto("abc")).toBeNull();
  });

  test("22. remove espaços e aceita milhar com vírgula decimal", () => {
    expect(parseCusto("  1 234,56 ")).toBe(1234.56);
  });

  test("23. aceita ponto como separador decimal", () => {
    expect(parseCusto("45.75")).toBe(45.75);
  });

  test("24. aceita zero como custo válido", () => {
    expect(parseCusto("0")).toBe(0);
    expect(parseCusto("0,00")).toBe(0);
  });

  test("25. arredonda para duas casas decimais (centavos)", () => {
    expect(parseCusto("2,996")).toBe(3);
    expect(parseCusto("10,001")).toBe(10);
  });
});

describe("toDateInputValue", () => {
  test("26. extrai YYYY-MM-DD de uma string ISO com horário", () => {
    expect(toDateInputValue("2024-08-20T12:00:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("27. retorna string vazia para texto que não representa data", () => {
    expect(toDateInputValue("ontem")).toBe("");
    expect(toDateInputValue("")).toBe("");
  });
});

describe("custoDisplayFromDb", () => {
  test("28. formata com duas casas decimais e vírgula", () => {
    expect(custoDisplayFromDb(33.9)).toBe("33,90");
    expect(custoDisplayFromDb(100)).toBe("100,00");
  });
});

describe("formatDateBR e formatDatePdf", () => {
  test("29. formatDateBR usa pt-BR com dia e mês com dois dígitos", () => {
    const s = formatDateBR(new Date(2024, 2, 5));
    expect(s).toMatch(/^05\/03\/2024$/);
  });

  test("30. formatDatePdf devolve o próprio texto quando a data é inválida", () => {
    expect(formatDatePdf("sem-data")).toBe("sem-data");
  });
});
