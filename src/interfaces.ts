export interface OptionData {
  option: string;
  votes: number;
  optionNumber: number;
}

export interface PollNoId {
  question: string;
  options: OptionData[];
  openTime: string;
  closeTime?: string;
}

export interface PollWithId extends PollNoId {
  id: string;
  voteUrl: string;
  masterUrl: string;
}

export interface VoteRequest {
  optionNumber: number;
  option: string;
  changeVoteBy: number;
}

export interface VoteRequestObject {
  voteModifications: VoteRequest[];
}
