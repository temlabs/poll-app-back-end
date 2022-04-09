import pollData from "./data/polls.json";
import { frontEndUrlRoot } from "./server";

export interface OptionData {
  name: string;
  count: number;
}

export interface PollNoId {
  question: string;
  options: OptionData[];
  openTime: string;
  closeTime: string;
  password: string;
}

export interface Poll extends PollNoId {
  id: number;
  voteUrl: string;
  masterUrl: string;
}

const polls: Poll[] = pollData;
const highestId: number = Math.max(...polls.map((x) => x.id));
let nextAvailableId: number = highestId + 1;

export const createPoll = (data: PollNoId): Poll => {
  const newPoll: Poll = {
    id: nextAvailableId,
    voteUrl: `${frontEndUrlRoot}#/polls/${nextAvailableId}`,
    masterUrl: `${frontEndUrlRoot}#/polls/${nextAvailableId}`,
    ...data,
  };
  polls.push(newPoll);
  nextAvailableId++;
  return newPoll;
};

export const deletePollById = (id: number): Poll | null => {
  const pollToDelete: Poll | undefined = getPollById(id);
  if (pollToDelete) {
    const pollIndex = polls.findIndex((p) => p.id === id);
    polls.splice(pollIndex, 1);
    console.log(polls);
    return pollToDelete;
  } else {
    return null;
  }
};

export const updatePoll = (id: number, newData: Partial<Poll>): Poll | null => {
  const indexOfPoll: number = polls.findIndex((p) => p.id === id);
  // type guard against "not found"
  if (indexOfPoll >= 0) {
    return Object.assign(polls[indexOfPoll], newData);
  } else {
    return null;
  }
};

export const getAllPolls = (): Poll[] => {
  return polls;
};

export const getPollById = (id: number): Poll | undefined => {
  const pollIndex: number = polls.findIndex((x) => x.id === id);
  return pollIndex === -1 ? undefined : polls[pollIndex];
};

export const getPollByIndex = (index: number): Poll => {
  return polls[index];
};
