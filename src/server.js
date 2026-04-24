const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const express = require("express");
const session = require("express-session");
const { formatDateBR } = require("./receita-utils");
const usuarioRouter = require("./routes/usuario");
const receitasRouter = require("./routes/receitas");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "frontend"));

app.locals.formatDateBR = formatDateBR;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "receitas-gc-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
  })
);

app.use("/receitas", receitasRouter);
app.use(usuarioRouter);

const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Servidor em http://${HOST}:${PORT}`);
});
