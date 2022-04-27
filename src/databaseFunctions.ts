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
  const {
    question,
    openTime,
    closeTime,
  }: { question: string; openTime: string; closeTime?: string } = pollToAdd;
  const insertPollQuery = "INSERT INTO polls values($1, $2, $3, $4, $5)";
  await client.query(insertPollQuery, [
    pollId,
    question,
    openTime,
    closeTime,
    masterKey,
  ]);

  // add options to options table
  const insertOptionRows = pollToAdd.options.map((currentOption, index) => {
    const optionRows:string = `(${index}, '${pollId}', '${currentOption.option}', 0)`;
    return optionRows;
  });

  const insertOptionsQuery = `INSERT INTO options VALUES ${insertOptionRows.join(
    ","
  )};`;
  await client.query(insertOptionsQuery);

  // assume everything goes well. package our complete object to return to client
  //const voteUrl = `${baseUrlFrontEnd}/polls/${pollId}`;
  const voteUrl = `${baseUrlFrontEnd}/polls/${pollId}`;
  const masterUrl = `${baseUrlFrontEnd}/polls/master/${masterKey}`;

  const createdPoll: PollWithId = Object.assign(pollToAdd, {
    id: pollId,
    voteUrl: voteUrl,
    masterUrl: masterUrl,
  });
  return createdPoll;
}

export async function getPollFromDatabaseById(
  pollId: string,
  masterKey: string,
  client: PoolClient
): Promise<PollWithId | string> {
  const selectPollQuery = `select distinct options.pollid, polls.question, option, votes, options.optionnumber, polls.masterkey from polls,options where options.pollid=$1 and polls.pollid=$1`;
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
  const optionsArray: OptionData[] = selectPollResult.rows.map((row) => {
    const votes = masterKey === row["masterkey"]? parseInt(row["votes"]): 0;
    const option: OptionData = {
      option: row["option"],
      votes: votes,
      optionNumber: parseInt(row["optionnumber"]),
    };
    return option;
  });

  const question: string = selectPollResult.rows[0]["question"];
  const openTime: string = selectPollResult.rows[0]["opentime"];
  const closeTime: string = selectPollResult.rows[0]["closetime"];
  const voteUrl = `${baseUrlFrontEnd}/polls/${pollId}`;
  //const masterUrl = `${baseUrlFrontEnd}/polls/master/${selectPollResult.rows[0]["masterkey"]}`;

  const retrievedPoll: PollWithId = {
    question: question,
    options: optionsArray,
    openTime: openTime,
    closeTime: closeTime,
    id: pollId,
    voteUrl: voteUrl,
    masterUrl: "no access",
  };
  console.log(retrievedPoll);
  return retrievedPoll;
}

export async function voteInPoll(
  pollId: string,
  VoteRequest: VoteRequest,
  client: PoolClient
): Promise<void | string> {
  const { changeVoteBy, optionNumber, option } = VoteRequest;
  const updateOptionsParameters = [changeVoteBy, pollId, optionNumber, option];
  const updateOptionsQuery = `update options set votes = votes + $1 where pollId = $2 and optionnumber = $3 and option=$4`;
  const updateOptionsResult: QueryResult | string = await client
    .query(updateOptionsQuery, updateOptionsParameters)
    .catch((e: Error) => e.message);
  if (typeof updateOptionsResult === "string") {
    return updateOptionsResult;
  }
}
