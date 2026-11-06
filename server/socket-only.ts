// Standalone Socket.IO server — no Next.js. Deployed separately (e.g. Railway/Render/Fly)
// from the Next.js frontend (e.g. Vercel), since serverless platforms can't host a
// persistent Socket.IO process with in-memory room state. See README for the split setup.
import { createServer } from "http";
import { initSocketServer } from "../lib/socketServer";

const port = parseInt(process.env.PORT || "4000", 10);

const httpServer = createServer((req, res) => {
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Doodle Crimes socket server is running.");
    return;
  }
  res.writeHead(404);
  res.end();
});

initSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`> Doodle Crimes socket server ready on port ${port}`);
});
