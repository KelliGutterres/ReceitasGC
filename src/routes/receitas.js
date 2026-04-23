const express = require("express");
const PDFDocument = require("pdfkit");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const {
  normalizeReceitaListFilters,
  buildReceitaListWhere,
  buildPdfExportHref,
  formatDatePdf,
  parseReceitaBody,
  parseCusto,
  toDateInputValue,
  custoDisplayFromDb,
} = require("../receita-utils");

const router = express.Router();

function streamReceitasPdf(res, rows, filters) {
  const PDF_COL = {
    headerBg: "#0f172a",
    headerMuted: "#94a3b8",
    metaBg: "#f1f5f9",
    metaBorder: "#cbd5e1",
    tableHead: "#334155",
    rowAlt: "#f8fafc",
    row: "#ffffff",
    border: "#e2e8f0",
    text: "#0f172a",
    textMuted: "#64748b",
    accent: "#2563eb",
  };

  function tipoPdf(t) {
    if (t === "doce") return "Doce";
    if (t === "salgada") return "Salgada";
    return String(t || "—");
  }

  function textoFiltrosPdf() {
    const p = [];
    if (filters.tipo_receita) p.push(`Tipo: ${tipoPdf(filters.tipo_receita)}`);
    if (filters.data_criacao) p.push(`Data de criacao: ${filters.data_criacao}`);
    return p.length ? p.join("  |  ") : "Nenhum filtro (todas as receitas)";
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="receitas.pdf"');

  const M = 42;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: M, bottom: M + 32, left: M, right: M },
    info: { Title: "Receitas GC", Author: "Receitas GC" },
  });
  doc.pipe(res);

  const pageW = doc.page.width;
  const contentW = pageW - M * 2;

  function maxY() {
    return doc.page.height - doc.page.margins.bottom - 8;
  }

  const bandH = 76;
  doc.save();
  doc.rect(0, 0, pageW, bandH).fill(PDF_COL.headerBg);
  doc.restore();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(22);
  doc.text("Receitas GC", M, 28, { width: contentW });
  doc.font("Helvetica").fontSize(10).fillColor(PDF_COL.headerMuted);
  doc.text("Relatorio de receitas", M, 56, { width: contentW });

  let y = bandH + 18;
  doc.y = y;

  const metaH = 54;
  doc.save();
  doc.rect(M, y, contentW, metaH).fill(PDF_COL.metaBg);
  doc.strokeColor(PDF_COL.metaBorder).lineWidth(0.5).rect(M, y, contentW, metaH).stroke();
  doc.restore();
  doc.fillColor(PDF_COL.textMuted).font("Helvetica-Bold").fontSize(8);
  doc.text("GERADO EM", M + 12, y + 10);
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COL.text);
  doc.text(new Date().toLocaleString("pt-BR"), M + 12, y + 22, { width: contentW - 24 });
  doc.fillColor(PDF_COL.textMuted).font("Helvetica-Bold").fontSize(8);
  doc.text("FILTROS APLICADOS", M + 12, y + 35);
  doc.font("Helvetica").fontSize(9).fillColor(PDF_COL.text);
  doc.text(textoFiltrosPdf(), M + 12, y + 47, { width: contentW - 24 });

  y += metaH + 20;
  doc.y = y;

  if (!rows.length) {
    doc.fontSize(11).fillColor(PDF_COL.textMuted).font("Helvetica");
    doc.text("Nenhuma receita encontrada para os filtros aplicados.", M, y, { width: contentW });
    doc.moveDown(2);
    doc.fontSize(8).fillColor(PDF_COL.textMuted).text("Receitas GC — exportacao", { width: contentW, align: "center" });
    doc.end();
    return;
  }

  const x0 = M;
  const colGap = 8;
  const gapsBetweenFiveCols = colGap * 4;
  const wNum = 28;
  const wTipo = 64;
  const wData = 72;
  const wCusto = 86;
  const wNome = contentW - wNum - wTipo - wData - wCusto - gapsBetweenFiveCols;
  const xNome = x0 + wNum + colGap;
  const xTipo = xNome + wNome + colGap;
  const xData = xTipo + wTipo + colGap;
  const xCusto = xData + wData + colGap;
  const custoTextW = wCusto - 6;
  const rowPad = 6;
  const headH = 26;
  const descBoxMax = 58;

  function drawTableHeaderPdf() {
    const yy = doc.y;
    doc.save();
    doc.rect(x0, yy, contentW, headH).fill(PDF_COL.tableHead);
    doc.restore();
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
    doc.text("#", x0 + 6, yy + 9, { width: wNum });
    doc.text("NOME", xNome, yy + 9, { width: wNome });
    doc.text("TIPO", xTipo, yy + 9, { width: wTipo });
    doc.text("DATA", xData, yy + 9, { width: wData });
    doc.text("CUSTO", xCusto + 3, yy + 9, { width: custoTextW, align: "right" });
    doc.y = yy + headH;
    doc.fillColor(PDF_COL.text);
  }

  function needSpacePdf(altura) {
    let guard = 0;
    while (doc.y + altura > maxY() && guard < 25) {
      guard += 1;
      doc.addPage();
      doc.y = doc.page.margins.top;
      doc.fillColor(PDF_COL.textMuted).font("Helvetica-Oblique").fontSize(9);
      doc.text("Continuacao do relatorio", x0, doc.y);
      doc.moveDown(1.1);
      doc.fillColor(PDF_COL.text);
      drawTableHeaderPdf();
    }
  }

  drawTableHeaderPdf();

  rows.forEach((r, idx) => {
    const desc = String(r.descricao || "")
      .replace(/\s+/g, " ")
      .trim();
    const temDesc = Boolean(desc);
    const baseRowH = 22 + rowPad * 2;
    const blocoDesc = temDesc ? descBoxMax + 8 : 0;
    const blockH = baseRowH + blocoDesc;

    needSpacePdf(blockH + 10);

    const yy = doc.y;
    const fill = idx % 2 === 0 ? PDF_COL.rowAlt : PDF_COL.row;
    doc.save();
    doc.rect(x0, yy, contentW, baseRowH).fill(fill);
    doc.strokeColor(PDF_COL.border).lineWidth(0.35).rect(x0, yy, contentW, baseRowH).stroke();
    doc.restore();

    doc.fillColor(PDF_COL.accent).font("Helvetica-Bold").fontSize(9);
    doc.text(String(r.id), x0 + 6, yy + rowPad + 2, { width: wNum });
    doc.fillColor(PDF_COL.text).font("Helvetica-Bold").fontSize(9);
    doc.text(String(r.nome || "—"), xNome, yy + rowPad + 2, { width: wNome, ellipsis: true });
    doc.font("Helvetica").fontSize(8).fillColor(PDF_COL.textMuted);
    doc.text(tipoPdf(r.tipo_receita), xTipo, yy + rowPad + 3, { width: wTipo });
    doc.text(formatDatePdf(r.data_registro), xData, yy + rowPad + 3, { width: wData });
    doc.font("Helvetica-Bold").fillColor(PDF_COL.text).fontSize(9);
    doc.text(`R$ ${Number(r.custo).toFixed(2).replace(".", ",")}`, xCusto + 3, yy + rowPad + 2, {
      width: custoTextW,
      align: "right",
    });

    doc.y = yy + baseRowH;

    if (temDesc) {
      const descLim = desc.length > 500 ? `${desc.slice(0, 500)}...` : desc;
      const boxTop = doc.y;
      doc.save();
      doc.rect(x0, boxTop, contentW, descBoxMax + 8).fill(fill);
      doc.moveTo(x0 + 8, boxTop + 6)
        .lineTo(x0 + 8, boxTop + descBoxMax + 2)
        .strokeColor(PDF_COL.accent)
        .lineWidth(2)
        .stroke();
      doc.restore();
      doc.fillColor(PDF_COL.textMuted).font("Helvetica").fontSize(8);
      const hDesc = Math.min(
        doc.heightOfString(descLim, { width: contentW - 28, lineGap: 2 }),
        descBoxMax
      );
      doc.text(descLim, x0 + 16, boxTop + 6, {
        width: contentW - 28,
        lineGap: 2,
        height: hDesc,
        ellipsis: true,
      });
      doc.y = boxTop + descBoxMax + 8;
    }

    doc.moveDown(2);
  });

  doc.font("Helvetica-Bold").fontSize(9).fillColor(PDF_COL.textMuted);
  doc.text(`Total: ${rows.length} receita(s)`, x0, doc.y, { width: contentW, align: "right" });
  doc.moveDown(1.5);
  doc.fontSize(8).fillColor(PDF_COL.textMuted).font("Helvetica");
  doc.text("Receitas GC — documento gerado automaticamente", x0, doc.y, {
    width: contentW,
    align: "center",
  });

  doc.end();
}

router.get("/exportar-pdf", requireAuth, async (req, res) => {
  const filters = normalizeReceitaListFilters(req.query);
  const { where, params } = buildReceitaListWhere(filters);
  try {
    const { rows } = await pool.query(
      `SELECT id, nome, descricao, data_registro, custo, tipo_receita
       FROM receita ${where}
       ORDER BY data_registro DESC, id DESC`,
      params
    );
    streamReceitasPdf(res, rows, filters);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).send("Erro ao gerar PDF.");
  }
});

router.get("/nova", requireAuth, (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  res.render("receita-form", {
    userNome: req.session.userNome,
    titulo: "Nova receita",
    modo: "criar",
    formAction: "/receitas",
    error: null,
    valores: {
      nome: "",
      descricao: "",
      data_registro: hoje,
      custo: "",
      tipo_receita: "",
    },
  });
});

router.get("/", requireAuth, async (req, res) => {
  const flash = req.session.flash || null;
  req.session.flash = null;
  const filters = normalizeReceitaListFilters(req.query);
  const { where, params } = buildReceitaListWhere(filters);
  try {
    const { rows } = await pool.query(
      `SELECT id, nome, descricao, data_registro, custo, tipo_receita
       FROM receita ${where}
       ORDER BY data_registro DESC, id DESC`,
      params
    );
    let filterEmpty = false;
    if (rows.length === 0 && (filters.tipo_receita || filters.data_criacao)) {
      const cnt = await pool.query(`SELECT COUNT(*)::int AS n FROM receita`);
      filterEmpty = cnt.rows[0].n > 0;
    }
    res.render("receitas", {
      receitas: rows,
      userNome: req.session.userNome,
      flash,
      filters,
      filterEmpty,
      pdfHref: buildPdfExportHref(filters),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao listar receitas.");
  }
});

router.post("/", requireAuth, async (req, res) => {
  const v = parseReceitaBody(req.body);
  const custo = parseCusto(v.custo);
  if (!v.nome) {
    return res.status(400).render("receita-form", {
      userNome: req.session.userNome,
      titulo: "Nova receita",
      modo: "criar",
      formAction: "/receitas",
      error: "Informe o nome da receita.",
      valores: v,
    });
  }
  if (!v.data_registro) {
    return res.status(400).render("receita-form", {
      userNome: req.session.userNome,
      titulo: "Nova receita",
      modo: "criar",
      formAction: "/receitas",
      error: "Informe a data de registro.",
      valores: v,
    });
  }
  if (custo === null) {
    return res.status(400).render("receita-form", {
      userNome: req.session.userNome,
      titulo: "Nova receita",
      modo: "criar",
      formAction: "/receitas",
      error: "Custo inválido. Use números (ex.: 12,50).",
      valores: v,
    });
  }
  if (v.tipo_receita !== "doce" && v.tipo_receita !== "salgada") {
    return res.status(400).render("receita-form", {
      userNome: req.session.userNome,
      titulo: "Nova receita",
      modo: "criar",
      formAction: "/receitas",
      error: "Selecione o tipo: doce ou salgada.",
      valores: v,
    });
  }
  try {
    await pool.query(
      `INSERT INTO receita (nome, descricao, data_registro, custo, tipo_receita)
       VALUES ($1, $2, $3, $4, $5)`,
      [v.nome, v.descricao || null, v.data_registro, custo, v.tipo_receita]
    );
    req.session.flash = { type: "ok", message: "Receita cadastrada com sucesso." };
    return res.redirect("/receitas");
  } catch (err) {
    console.error(err);
    return res.status(500).render("receita-form", {
      userNome: req.session.userNome,
      titulo: "Nova receita",
      modo: "criar",
      formAction: "/receitas",
      error: "Não foi possível salvar. Tente novamente.",
      valores: v,
    });
  }
});

router.get("/:id/editar", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.redirect("/receitas");
  try {
    const { rows } = await pool.query(
      `SELECT id, nome, descricao, data_registro, custo, tipo_receita FROM receita WHERE id = $1`,
      [id]
    );
    const r = rows[0];
    if (!r) return res.redirect("/receitas");
    res.render("receita-form", {
      userNome: req.session.userNome,
      titulo: "Editar receita",
      modo: "editar",
      formAction: `/receitas/${id}/atualizar`,
      error: null,
      valores: {
        nome: r.nome,
        descricao: r.descricao || "",
        data_registro: toDateInputValue(r.data_registro),
        custo: custoDisplayFromDb(r.custo),
        tipo_receita: r.tipo_receita,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao carregar receita.");
  }
});

router.post("/:id/atualizar", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.redirect("/receitas");
  const v = parseReceitaBody(req.body);
  const custo = parseCusto(v.custo);

  const renderErr = (error) =>
    res.status(400).render("receita-form", {
      userNome: req.session.userNome,
      titulo: "Editar receita",
      modo: "editar",
      formAction: `/receitas/${id}/atualizar`,
      error,
      valores: v,
    });

  if (!v.nome) return renderErr("Informe o nome da receita.");
  if (!v.data_registro) return renderErr("Informe a data de registro.");
  if (custo === null) return renderErr("Custo inválido. Use números (ex.: 12,50).");
  if (v.tipo_receita !== "doce" && v.tipo_receita !== "salgada") {
    return renderErr("Selecione o tipo: doce ou salgada.");
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE receita SET nome = $1, descricao = $2, data_registro = $3, custo = $4, tipo_receita = $5
       WHERE id = $6`,
      [v.nome, v.descricao || null, v.data_registro, custo, v.tipo_receita, id]
    );
    if (rowCount === 0) return res.redirect("/receitas");
    req.session.flash = { type: "ok", message: "Receita atualizada com sucesso." };
    return res.redirect("/receitas");
  } catch (err) {
    console.error(err);
    return res.status(500).render("receita-form", {
      userNome: req.session.userNome,
      titulo: "Editar receita",
      modo: "editar",
      formAction: `/receitas/${id}/atualizar`,
      error: "Não foi possível salvar. Tente novamente.",
      valores: v,
    });
  }
});

router.post("/:id/excluir", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.redirect("/receitas");
  try {
    const { rowCount } = await pool.query(`DELETE FROM receita WHERE id = $1`, [id]);
    req.session.flash =
      rowCount > 0
        ? { type: "ok", message: "Receita excluída." }
        : { type: "err", message: "Receita não encontrada." };
  } catch (err) {
    console.error(err);
    req.session.flash = { type: "err", message: "Não foi possível excluir a receita." };
  }
  return res.redirect("/receitas");
});

module.exports = router;
