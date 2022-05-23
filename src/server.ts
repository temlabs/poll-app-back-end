import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";

import {
  postPollToDatabase,
  getPollFromDatabaseById,
  voteInPoll,
} from "./databaseFunctions";

import filePath from "./filePath";
import { Client, Pool } from "pg";
import { PollNoId, VoteRequestObject } from "./interfaces";
const app = express();
//const http = require("http");
import http from "http";
const server = http.createServer(app);

console.log(dotenv.config()); // why does database connection only work if I include this console log?
// also how to end pool gracefully?
// also error handling, I'm currently doing none which isn't great. How can I get started in this space?
// the patching/voting needs more sophisticated error handling, maybe using begin, commit and rollback in case votes mods break halfway?

const herokuSSLSetting = { rejectUnauthorized: false };
const sslSetting = process.env.LOCAL ? false : herokuSSLSetting;
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: sslSetting,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};

const pool = new Pool(dbConfig);

app.use(express.json());
app.use(cors());
//app.options('*',cors());
dotenv.config();

const PORT_NUMBER = process.env.PORT ?? 4000;
export const baseUrl =
  process.env.NODE_ENV === "development"
    ? `localhost:${PORT_NUMBER.toString()}`
    : "https://poll-app-back-end.herokuapp.com/";

export const baseUrlFrontEnd =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://p-poll.netlify.app";

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// API info page
app.get("/", (req, res) => {
  const pathToFile = filePath("../public/index.html");
  res.sendFile(pathToFile);
});

// GET all polls
app.get("/polls/", async (req, res) => {
  const client = await pool.connect();
  const result = await client.query("select * from polls");
  res.status(200).json(result.rows);
  client.release();
});

// POST poll to database
app.post<{}, {}, PollNoId>("/poll", async (req, res) => {
  const postData: PollNoId = req.body;
  const client = await pool.connect();
  await postPollToDatabase(postData, client).then((createdPoll) =>
    res.status(201).json(createdPoll)
  );
  client.release();
});

// GET poll by Id
app.get<{ pollId: string; masterKey: string }>(
  "/polls/:pollId/:masterKey?", cors(),
  async (req, res) => {
    const pollId: string = req.params.pollId;
    const masterKey: string = req.params.masterKey;
    const client = await pool.connect();
    getPollFromDatabaseById(pollId, masterKey, client).then(
      (retrievedPoll) =>
        typeof retrievedPoll === "string"
          ? res.status(404).json(retrievedPoll)
          : res.status(200).json(retrievedPoll)
    ).finally(() => client.release()).catch((e) =>
      res.status(500).json(e)
    )

  }
);

// DELETE poll - not currently used
// app.delete<{ id: string }>("/polls/:id", (req, res) => {
//   const matchingPoll = getPollById(parseInt(req.params.id));
//   if (!matchingPoll) {
//     res.status(404).json(notFoundMessage(parseInt(req.params.id)));
//   } else {
//     deletePollById(parseInt(req.params.id));
//     res.status(200).json(matchingPoll);
//   }
// });

// PATCH /items/:id
app.patch<{ id: string }, {}, VoteRequestObject>(
  "/polls/:id",
  async (req, res) => {
    const pollId = req.params.id;
    const client = await pool.connect();
    voteInPoll(pollId, req.body.voteModifications[0], client)
      .then(() => {
        if (req.body.voteModifications.length > 1) {
          voteInPoll(pollId, req.body.voteModifications[1], client);
        }
      })
      .then(() => res.status(200).json({ result: "the vote was updated" }))
      .catch((e) => console.log(e));

    client.release();
  }
);

io.on("connection", async (socket) => {
  // console.log('a user connected');
  // console.log(`Master key is: ${socket.handshake.query.masterKey}`)
  const masterKey = socket.handshake.query.masterKey as string;
  const client = await pool.connect();
  const dbRes = await client.query(
    "SELECT pollid from polls WHERE masterkey = $1",
    [masterKey]
  );
  const pollId = dbRes.rows[0]["pollid"] as string;
  pool.connect((err, client, release) => {
    if (err) {
      return console.error("Error acquiring client", err.stack);
    }
    const listenQuery = `LISTEN n${pollId.replace(/-/g, "_")}`;
    client.query(listenQuery);
    client.on("notification", () => {
      getPollFromDatabaseById(pollId, masterKey, client).then((res) => {
        socket.emit("message", res);
      });
    });
    socket.on("disconnect", () => {
      release();
    });
  });
});

server.listen(PORT_NUMBER, () => {
  console.log(`Server is listening on port ${PORT_NUMBER}!`);
});
