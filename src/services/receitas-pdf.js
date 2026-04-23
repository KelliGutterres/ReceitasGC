const PDFDocument = require("pdfkit");

function formatDatePdf(value) {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR");
}

function buildPdfExportHref(filters) {
  const parts = [];
  if (filters.tipo_receita) parts.push(`tipo_receita=${encodeURIComponent(filters.tipo_receita)}`);
  if (filters.data_criacao) parts.push(`data_criacao=${encodeURIComponent(filters.data_criacao)}`);
  return `/receitas/exportar-pdf${parts.length ? `?${parts.join("&")}` : ""}`;
}

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

module.exports = {
  buildPdfExportHref,
  formatDatePdf,
  streamReceitasPdf,
};
