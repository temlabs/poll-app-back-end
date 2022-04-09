import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import {
  createPoll,
  deletePollById,
  getAllPolls,
  getPollById,
  Poll,
  updatePoll,
} from "./db";
import filePath from "./filePath";

const app = express();

const notFoundMessage = (id: number) =>
  `The poll with id:${id} could not be found.`;

/** Parses JSON data in a request automatically */
app.use(express.json());
/** To allow 'Cross-Origin Resource Sharing': https://en.wikipedia.org/wiki/Cross-origin_resource_sharing */
app.use(cors());

// read in contents of any environment variables in the .env file
dotenv.config();

// use the environment variable PORT, or 4000 as a fallback
const PORT_NUMBER = process.env.PORT ?? 4000;
export const baseUrl =
  process.env.NODE_ENV === "development"
    ? `localhost:${PORT_NUMBER.toString()}`
    : "https://poll-app-back-end.herokuapp.com/";

export const baseUrlFrontEnd = process.env.NODE_ENV === "development" 
    ? "localhost:3000" 
    : "https://p-poll.netlify.app/";


// API info page
app.get("/", (req, res) => {
  const pathToFile = filePath("../public/index.html");
  res.sendFile(pathToFile);
});

// GET /items
app.get("/polls", (req, res) => {
  const allPolls = getAllPolls();
  res.status(200).json(allPolls);
});

// POST /poll
app.post<{}, {}, Poll>("/poll", (req, res) => {
  // to be rigorous, ought to handle non-conforming request bodies
  // ... but omitting this as a simplification
  const postData = req.body;
  const createdPoll = createPoll(postData);
  res.status(201).json(createdPoll);
});

// GET /items/:id
app.get<{ id: string }>("/polls/:id", (req, res) => {
  const matchingPoll: Poll | undefined = getPollById(parseInt(req.params.id));
  if (!matchingPoll) {
    res.status(404).json(notFoundMessage(parseInt(req.params.id)));
  } else {
    res.status(200).json(matchingPoll);
  }
});

// DELETE /items/:id
app.delete<{ id: string }>("/polls/:id", (req, res) => {
  const matchingPoll = getPollById(parseInt(req.params.id));
  if (!matchingPoll) {
    res.status(404).json(notFoundMessage(parseInt(req.params.id)));
  } else {
    deletePollById(parseInt(req.params.id));
    res.status(200).json(matchingPoll);
  }
});

// PATCH /items/:id
app.patch<{ id: string }, {}, Partial<Poll>>("/polls/:id", (req, res) => {
  const matchingSignature: Poll | null = updatePoll(
    parseInt(req.params.id),
    req.body
  );
  if (matchingSignature === null) {
    res.status(404).json("Not found");
  } else {
    res.status(200).json(matchingSignature);
  }
});

app.listen(PORT_NUMBER, () => {
  console.log(`Server is listening on port ${PORT_NUMBER}!`);
});
