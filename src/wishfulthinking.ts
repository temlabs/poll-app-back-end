import express from "express";


import {
    getPollFromDatabaseById,
    postPollToDatabase,
} from "./databaseFunctions";

import { Pool, PoolClient } from "pg";
import { PollNoId, VoteRequestObject } from "./interfaces";
const app = express();
const herokuSSLSetting = { rejectUnauthorized: false };
const sslSetting = process.env.LOCAL ? false : herokuSSLSetting;
const dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: sslSetting,
};

const pool = new Pool(dbConfig);


app.post<{}, {}, PollNoId>("/poll", async (req, res) => {
    const postData: PollNoId = req.body;
    let client: PoolClient | undefined;
    try {
        client = await pool.connect();
        const createdPoll = postPollToDatabase(postData, client)
        res.status(201).json(createdPoll)


    } catch (error) {
        res.status(500).json(error as {})
    } finally {
        if (client) {
            client.release();
        }
    }

});

interface FakeReq {
    body: any;
}

interface FakeRes {
    status: (code: number) => FakeRes;
    json: (payload: any) => FakeRes;
}

const handlePostPollAndReply = (client: PoolClient, req: FakeReq, res: FakeRes) => {
    const postData: PollNoId = req.body;
    const createdPoll = postPollToDatabase(postData, client)
    res.status(201).json(createdPoll)
}


app.post<{}, {}, PollNoId>("/poll", async (req, res) => {
    await doWithDatabaseClientAndErrorHandling(handlePostPollAndReply, req, res);
});




app.post<{}, {}, PollNoId>("/poll/:id", async (req, res) => {
    await doWithDatabaseClientAndErrorHandling(handleGetPollFromDatabase, req, res)
})

async function handleGetPollFromDatabase(client:PoolClient,req:FakeReq, res: FakeRes) {
    const pollId = req.body.pollId;
    const masterKey = req.body.masterKey;
    const retrievedPoll = getPollFromDatabaseById(pollId, masterKey, client)
    res.status(200).json(retrievedPoll);
}


app.post<{}, {}, PollNoId>("/poll/:id", async (req, res) => {
    await doWithDatabaseClientAndErrorHandling((client:PoolClient,req:FakeReq, res: FakeRes) => {
        const pollId = req.body.pollId;
        const masterKey = req.body.masterKey;
        const retrievedPoll = getPollFromDatabaseById(pollId, masterKey, client)
        res.status(200).json(retrievedPoll)
},req, res)


type DatabaseOperation = (client: PoolClient, req: FakeReq, res: FakeRes) => void

async function doWithDatabaseClientAndErrorHandling(functionToPerform: DatabaseOperation, req: FakeReq, res: FakeRes) {

    let client: PoolClient | undefined;

    try {
        client = await pool.connect();
        functionToPerform(client, req, res);
    } catch (error) {
        res.status(500).json(error as {});
    } finally {
        client?.release();
    }
}