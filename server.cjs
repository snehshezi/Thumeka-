// iisnode (Plesk Windows) / Phusion Passenger (Plesk Linux) entry point.
//
// Uses the `.cjs` extension so this file is treated as CommonJS even though
// `package.json` declares `"type": "module"`. Most Node hosting runtimes
// (including iisnode) load the startup file via require() — that mandates
// CommonJS semantics for this file.
//
// `PORT`:
// - iisnode passes a named pipe string (e.g. `\\.\pipe\xxx`).
// - Passenger / local dev pass a TCP port number.
// `listen()` accepts both; we just hand the raw value through.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const next = require("next");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("http");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT || 3000;
// next() wants a number for its own logging; pass undefined when iisnode
// hands us a pipe so Next doesn't try to interpret it.
const numericPort = Number.isFinite(Number(port)) ? Number(port) : undefined;

const app = next({ dev, hostname, port: numericPort });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, () => {
        console.log(`> Thumeka ready (listening on ${port})`);
      });
  })
  .catch((err) => {
    console.error("Thumeka failed to start:", err);
    process.exit(1);
  });
