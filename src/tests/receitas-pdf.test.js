const { buildPdfExportHref, formatDatePdf } = require("../services/receitas-pdf");

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

describe("formatDatePdf", () => {
  test("30. devolve o próprio texto quando a data é inválida", () => {
    expect(formatDatePdf("sem-data")).toBe("sem-data");
  });
});
