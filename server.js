const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const pool = require("./db/pool");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.locals.formatDateBR = function formatDateBR(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "receitas-gc-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

function requireAuth(req, res, next) {
  if (req.session.userId) return next();
  return res.redirect("/login");
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
  } catch (_) {}
  return "";
}

function custoDisplayFromDb(custo) {
  return Number(custo).toFixed(2).replace(".", ",");
}

app.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/receitas");
  res.render("login", { error: null, login: "" });
});

app.post("/login", async (req, res) => {
  const login = String(req.body.login || "").trim();
  const senha = String(req.body.senha || "");

  if (!login || !senha) {
    return res.status(400).render("login", {
      error: "Informe login e senha.",
      login,
    });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id, nome, login, senha, situacao FROM usuario WHERE login = $1`,
      [login]
    );
    const user = rows[0];
    if (!user || user.situacao !== "ativo") {
      return res.status(401).render("login", {
        error: "Credenciais inválidas ou usuário inativo.",
        login,
      });
    }
    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) {
      return res.status(401).render("login", {
        error: "Credenciais inválidas ou usuário inativo.",
        login,
      });
    }
    req.session.userId = user.id;
    req.session.userNome = user.nome;
    return res.redirect("/receitas");
  } catch (err) {
    console.error(err);
    return res.status(500).render("login", {
      error: "Erro ao acessar o banco. Verifique o PostgreSQL.",
      login,
    });
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

app.get("/receitas", requireAuth, async (req, res) => {
  const flash = req.session.flash || null;
  req.session.flash = null;
  try {
    const { rows } = await pool.query(
      `SELECT id, nome, descricao, data_registro, custo, tipo_receita
       FROM receita
       ORDER BY data_registro DESC, id DESC`
    );
    res.render("receitas", {
      receitas: rows,
      userNome: req.session.userNome,
      flash,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro ao listar receitas.");
  }
});

app.get("/receitas/nova", requireAuth, (req, res) => {
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

app.post("/receitas", requireAuth, async (req, res) => {
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

app.get("/receitas/:id/editar", requireAuth, async (req, res) => {
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

app.post("/receitas/:id/atualizar", requireAuth, async (req, res) => {
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

app.post("/receitas/:id/excluir", requireAuth, async (req, res) => {
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

app.get("/", (req, res) => {
  if (req.session.userId) return res.redirect("/receitas");
  res.redirect("/login");
});

const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Servidor em http://${HOST}:${PORT}`);
});
