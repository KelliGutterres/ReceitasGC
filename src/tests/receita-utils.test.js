const {
  parseReceitaBody,
  parseCusto,
  toDateInputValue,
  custoDisplayFromDb,
  formatDateBR,
} = require("../receita-utils");

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

describe("formatDateBR", () => {
  test("29. usa pt-BR com dia e mês com dois dígitos", () => {
    const s = formatDateBR(new Date(2024, 2, 5));
    expect(s).toMatch(/^05\/03\/2024$/);
  });
});
