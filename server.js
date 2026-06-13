#!/usr/bin/env node
"use strict";
const { createServer } = require("http");
const { parse } = require("url");
const path = require("path");
const next = require("next");

const port     = parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";
const dir      = path.resolve(__dirname);

const app    = next({ dev: false, hostname, port, dir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      // nginx strips /equipo_04/api/ before forwarding to this port.
      // e.g. GET /equipo_04/api/citas → arrives here as GET /citas
      // Restore the full path so Next.js (basePath=/equipo_04) can route it.
      if (!parsedUrl.pathname.startsWith("/equipo_04")) {
        parsedUrl.pathname = "/equipo_04/api" + parsedUrl.pathname;
        req.url = parsedUrl.pathname + (parsedUrl.search || "");
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  }).listen(port, hostname, () => {
    console.log(`> BarberHost equipo_04 corriendo en puerto ${port}`);
    console.log(`> URL publica: http://2.25.174.243/equipo_04/`);
  });
});
