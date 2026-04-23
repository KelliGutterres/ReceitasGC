const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { normalizeReceitaListFilters, buildReceitaListWhere } = require("../receita-filters");
const { buildPdfExportHref, streamReceitasPdf } = require("../services/receitas-pdf");
const { parseReceitaBody, parseCusto, toDateInputValue, custoDisplayFromDb } = require("../receita-utils");

const router = express.Router();

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
