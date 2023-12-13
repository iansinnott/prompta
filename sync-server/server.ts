import Fastify from "fastify";
import { encode, decode, tags, hexToBytes } from "@vlcn.io/ws-common";
import { createDb, DBWrapper } from "./DBWrapper.js";
import cors from "@fastify/cors";

const PORT = process.env.PORT ? Number(process.env.PORT) : 8081;

const envToLogger: Record<string, any> = {
  development: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
  production: true,
};

// Create our Fastify server
const app = Fastify({
  logger: envToLogger[process.env.NODE_ENV as string] ?? true,
});

// Add a parser to handle binary data sent by the client
app.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_req, body, done) => {
  try {
    done(null, { raw: body });
  } catch (error: any) {
    error.statusCode = 400;
    done(error, undefined);
  }
});

// Enable cors because at least initially i expect to host this on a separate subdomain
await app.register(cors);

/**
 * Endpoint that clients can call to `get` or `pull` changes
 * from the server.
 */
app.get<{
  Params: { room: string };
  Querystring: {
    schemaName: string;
    schemaVersion: string;
    requestor: string;
    since: string;
  };
}>("/changes/:room", async (req, res) => {
  let db;
  try {
    db = await createDb(
      req.params.room,
      req.query.schemaName as string,
      BigInt(req.query.schemaVersion as string)
    );
  } catch (e: any) {
    if (e.code === "SQLITE_IOERR_WRITE" || e.message?.includes("readonly database")) {
      res.status(400).send({
        message: "make and push changes first to create or migrate the DB on the server.",
      });
      return;
    }

    throw e;
  }

  try {
    const requestorSiteId = hexToBytes(req.query.requestor as string);
    const sinceVersion = BigInt(req.query.since as string);

    const changes = db.getChanges(sinceVersion, requestorSiteId);
    const encoded = encode({
      _tag: tags.Changes,
      changes,
      sender: db.getId(),
      since: [sinceVersion, 0],
    });
    res.header("Content-Type", "application/octet-stream");

    app.log.info(`returning ${changes.length} changes`);
    res.send(encoded);
  } finally {
    db.close();
  }
});

/**
 * Endpoint for clients to post their database changes to.
 */
app.post<{
  Params: { room: string };
  Querystring: { schemaName: string; schemaVersion: string };
}>("/changes/:room", {
  config: {
    rawBody: true,
  },
  handler: async (req, res) => {
    const data = new Uint8Array((req.body as any).raw);

    const msg = decode(data);
    if (msg._tag != tags.Changes) {
      throw new Error(`Expected Changes message but got ${msg._tag}`);
    }

    const db = await createDb(
      req.params.room,
      req.query.schemaName as string,
      BigInt(req.query.schemaVersion as string)
    );
    try {
      db.applyChanges(msg);
      res.send({ status: "OK" });
    } finally {
      db.close();
    }
  },
});

/**
 * Endpoint for clients to register a schema with the server.
 */
app.post<{
  Body: {
    schemaName: string;
    content: string;
  };
}>("/schema", {
  handler: async (req, res) => {
    const result = await DBWrapper.registerSchema(req.body.schemaName, req.body.content);
    let status = 200;

    switch (result.status) {
      case "ok":
        status = 201;
        break;
      case "noop":
        status = 200;
        break;
      case "error":
        status = 400;
        break;
    }

    res.status(status).send(result);
  },
});

/**
 * A healthcheck and verification endpoint, so that the client can check if this
 * is a valid sync server.
 */
app.get("/health", async (req, res) => {
  res.send({ status: "ok", n: 47 });
});

app.listen({ port: PORT, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }

  app.log.info(`server listening on ${address}`);
});
