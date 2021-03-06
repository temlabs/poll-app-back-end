import { PoolClient, QueryResult } from "pg";
import { OptionData, PollNoId, PollWithId, VoteRequest } from "./interfaces";
import { baseUrlFrontEnd } from "./server";
import { v4 as uuidv4 } from "uuid";

export async function postPollToDatabase(
  pollToAdd: PollNoId,
  client: PoolClient
): Promise<PollWithId> {
  // add poll to polls table
  const pollId: string = uuidv4();
  const masterKey: string = uuidv4();
  const { question, openTime, closeTime } = pollToAdd;
  const insertPollQuery = "INSERT INTO polls values($1, $2, $3, $4, $5)";
  await client.query(insertPollQuery, [
    pollId,
    question,
    openTime,
    closeTime,
    masterKey,
  ]);

  // add options to options table
  const insertOptionRows = pollToAdd.options.map(
    (currentOption, index) =>
      `(${index}, '${pollId}', '${currentOption.option}', 0)`
  ); // vulnerability: check SQL injection

  const insertOptionsQuery = `INSERT INTO options VALUES ${insertOptionRows.join(
    ","
  )};`;
  await client.query(insertOptionsQuery);

  // assume everything goes well. package our complete object to return to client
  //const voteUrl = `${baseUrlFrontEnd}/polls/${pollId}`;
  const voteUrl = `${baseUrlFrontEnd}/polls/${pollId}`;
  const masterUrl = `${baseUrlFrontEnd}/master/${pollId}/${masterKey}`;

  const createdPoll: PollWithId = Object.assign(pollToAdd, {
    id: pollId,
    voteUrl: voteUrl,
    masterUrl: masterUrl,
  });
  return createdPoll;
}

export async function getPollFromDatabaseById(
  pollId: string,
  masterKey: string | undefined,
  client: PoolClient
): Promise<PollWithId | string> {
  const selectPollQuery = `select distinct options.pollid, polls.question, option, votes, options.optionnumber, polls.masterkey, polls.opentime, polls.closetime from polls,options where options.pollid=$1 and polls.pollid=$1`;
  const selectPollResult: QueryResult | string = await client
    .query(selectPollQuery, [pollId])
    .catch((e: Error) => e.message);

  // query failed
  if (typeof selectPollResult === "string") {
    return selectPollResult;
  }

  if (selectPollResult.rows.length === 0) {
    return "A poll with this id could not be found";
  }

  const question: string = selectPollResult.rows[0]["question"];
  const openTime: string = selectPollResult.rows[0]["opentime"];
  const closeTime: string = selectPollResult.rows[0]["closetime"];
  const voteUrl = `${baseUrlFrontEnd}/polls/${pollId}`;
  const pollIsClosed =
    closeTime !== null && new Date(closeTime) > new Date(openTime);

  const optionsArray: OptionData[] = selectPollResult.rows.map((row) => {
    const votes =
      masterKey === row["masterkey"] || pollIsClosed
        ? parseInt(row["votes"])
        : 0;
    const option: OptionData = {
      option: row["option"],
      votes: votes,
      optionNumber: parseInt(row["optionnumber"]),
    };
    return option;
  });

  const retrievedPoll: PollWithId = {
    question: question,
    options: optionsArray,
    openTime: openTime,
    closeTime: closeTime,
    id: pollId,
    voteUrl: voteUrl,
    masterUrl: "no access",
  };

  //console.log(retrievedPoll)
  return retrievedPoll;
}

export async function voteInPoll(
  pollId: string,
  VoteRequest: VoteRequest,
  client: PoolClient
): Promise<void | string> {
  const { changeVoteBy, optionNumber } = VoteRequest;
  const updateOptionsParameters = [changeVoteBy, pollId, optionNumber];
  const updateOptionsQuery = `WITH owpd AS (
    SELECT option, options.pollid, optionnumber, closetime, opentime FROM options
      LEFT JOIN polls
      ON options.pollid = polls.pollid
    )
    UPDATE options
    SET votes = options.votes + $1
    FROM owpd
    WHERE options.pollid= $2 and owpd.pollid = $2 and options.optionnumber = $3 and (owpd.closetime is null or NOW() < owpd.closetime)
    returning *;`;
  //  const updateOptionsResult: QueryResult | string =
  await client.query(updateOptionsQuery, updateOptionsParameters);
}

export async function closePoll(
  pollId: string,
  client: PoolClient
): Promise<void> {
  const closePollParameters = [pollId];
  const closePollQuery = "UPDATE polls SET closetime = NOW() WHERE pollid = $1";
  await client.query(closePollQuery, closePollParameters);
}
