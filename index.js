#!/usr/bin/env node
const { createServer } = require("http");
const { parse } = require("url");
const { exec } = require("child_process");
const next = require("next");

const dev      = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST  || "0.0.0.0";
const port     = parseInt(process.env.PORT || "3000", 10);

const app    = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function openBrowser(url) {
  const cmd =
    process.platform === "win32"  ? `start "" "${url}"` :
    process.platform === "darwin" ? `open "${url}"` :
                                    `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.warn("  No se pudo abrir el navegador automáticamente.");
  });
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  }).listen(port, hostname, (err) => {
    if (err) throw err;

    const localUrl   = `http://localhost:${port}`;
    const networkUrl = `http://192.168.1.160:${port}`;

    console.log("\n  BarberHost listo:\n");
    console.log(`  Local:    ${localUrl}`);
    console.log(`  Red:      ${networkUrl}`);
    console.log(`  Entorno:  ${dev ? "desarrollo" : "producción"}\n`);

    openBrowser(localUrl);
  });
});
