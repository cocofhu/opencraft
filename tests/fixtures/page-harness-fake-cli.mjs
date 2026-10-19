const args = process.argv.slice(2);
const mode = process.env.FAKE_MODE ?? "ready";
const opt = (name) => args[args.indexOf(name) + 1];

if (mode === "crash") {
  process.stderr.write("error: port 17990 is already in use\n");
  process.exit(1);
}
if (mode === "silent") {
  setInterval(() => {}, 1000);
} else if (mode === "ready") {
  const port = Number(opt("--port"));
  process.stdout.write(`${JSON.stringify({
    event: "ready",
    version: "0.0.0-test",
    pid: process.pid,
    appUrl: `http://127.0.0.1:${port}`,
    controlUrl: `http://127.0.0.1:${port + 1}`,
    mode: "review",
    noAgent: args.includes("--no-agent"),
    embedToken: "embed-secret-token",
  })}\n`);
  setInterval(() => {}, 1000);
}
