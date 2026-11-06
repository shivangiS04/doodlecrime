import { createServer } from "http";
import next from "next";
import { initSocketServer } from "../lib/socketServer";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Doodle Crimes ready on http://localhost:${port}`);
  });
});
