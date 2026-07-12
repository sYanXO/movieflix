import { useReducer } from 'react';
import { QuestionResponse } from '@/lib/api';

export type QuizStatus =
  | 'INITIALIZING'
  | 'TAKING_QUIZ'
  | 'LOADING_NEXT_QUESTION'
  | 'HANDOFF_CHOICE'
  | 'HANDOFF_LOCAL'
  | 'WAITING_FOR_FRIEND'
  | 'SUBMITTING';

export interface HistoryEntry {
  question: QuestionResponse;
  questionNum: number;
  answers: Record<string, string>;
  upcoming: QuestionResponse[];
}

export interface QuizState {
  status: QuizStatus;
  friendPerson: 'A' | 'B';
  answersA: Record<string, string>;
  sessionId: string | null;
  copied: boolean;

  answers: Record<string, string>;
  currentQ: QuestionResponse | null;
  upcomingQuestions: QuestionResponse[];
  questionNum: number;

  error: string | null;

  selectedOption: string | null;
  multiSelected: Set<string>;
  history: HistoryEntry[];
}

export type QuizAction =
  | { type: 'INIT_START'; payload: { friendPerson: 'A' | 'B'; sessionId: string | null; answersA?: Record<string, string> } }
  | { type: 'INIT_SUCCESS'; payload: { currentQ: QuestionResponse } }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'ANSWER_SELECT'; payload: { option: string; currentQ: QuestionResponse } }
  | { type: 'MULTI_TOGGLE'; payload: { option: string; noneOption?: string } }
  | { type: 'SUBMIT_MULTI_SELECT'; payload: { currentQ: QuestionResponse } }
  | { type: 'NEXT_QUESTION_START'; payload: { newAnswers: Record<string, string> } }
  | { type: 'NEXT_QUESTION_SUCCESS'; payload: { currentQ?: QuestionResponse; upcomingQuestions?: QuestionResponse[] } }
  | { type: 'HANDOFF_CHOICE'; payload: { finalAnswers: Record<string, string> } }
  | { type: 'HANDOFF_LOCAL' }
  | { type: 'HANDOFF_REMOTE_START' }
  | { type: 'HANDOFF_REMOTE_SUCCESS'; payload: { sessionId: string } }
  | { type: 'START_PERSON_B'; payload: { currentQ: QuestionResponse } }
  | { type: 'SUBMIT_START' }
  | { type: 'COPY_LINK_SUCCESS' }
  | { type: 'RESET_COPY_LINK' }
  | { type: 'BACK' };

export const initialState: QuizState = {
  status: 'INITIALIZING',
  friendPerson: 'A',
  answersA: {},
  sessionId: null,
  copied: false,
  answers: {},
  currentQ: null,
  upcomingQuestions: [],
  questionNum: 0,
  error: null,
  selectedOption: null,
  multiSelected: new Set(),
  history: [],
};

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'INIT_START':
      return {
        ...state,
        status: 'INITIALIZING',
        error: null,
        friendPerson: action.payload.friendPerson,
        sessionId: action.payload.sessionId,
        answersA: action.payload.answersA ?? state.answersA,
      };
    case 'INIT_SUCCESS':
      return {
        ...state,
        status: 'TAKING_QUIZ',
        error: null,
        currentQ: action.payload.currentQ,
        questionNum: 1,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'ANSWER_SELECT':
      return {
        ...state,
        selectedOption: action.payload.option,
        history: [
          ...state.history,
          {
            question: action.payload.currentQ,
            questionNum: state.questionNum,
            answers: state.answers,
            upcoming: state.upcomingQuestions,
          },
        ],
      };
    case 'MULTI_TOGGLE': {
      const next = new Set(state.multiSelected);
      const { option, noneOption } = action.payload;
      if (noneOption && option === noneOption) {
        if (next.has(option)) {
          next.clear();
        } else {
          next.clear();
          next.add(option);
        }
      } else {
        if (next.has(option)) {
          next.delete(option);
        } else {
          if (noneOption) next.delete(noneOption);
          next.add(option);
        }
      }
      return { ...state, multiSelected: next };
    }
    case 'SUBMIT_MULTI_SELECT':
      return {
        ...state,
        history: [
          ...state.history,
          {
            question: action.payload.currentQ,
            questionNum: state.questionNum,
            answers: state.answers,
            upcoming: state.upcomingQuestions,
          },
        ],
      };
    case 'NEXT_QUESTION_START':
      return {
        ...state,
        status: 'LOADING_NEXT_QUESTION',
        error: null,
        answers: action.payload.newAnswers,
        selectedOption: null,
        multiSelected: new Set(),
      };
    case 'NEXT_QUESTION_SUCCESS':
      return {
        ...state,
        status: 'TAKING_QUIZ',
        error: null,
        currentQ: action.payload.currentQ ?? state.currentQ,
        upcomingQuestions: action.payload.upcomingQuestions ?? state.upcomingQuestions,
        questionNum: action.payload.currentQ ? state.questionNum + 1 : state.questionNum,
      };
    case 'HANDOFF_CHOICE':
      return {
        ...state,
        status: 'HANDOFF_CHOICE',
        answersA: action.payload.finalAnswers,
        error: null,
      };
    case 'HANDOFF_LOCAL':
      return {
        ...state,
        status: 'HANDOFF_LOCAL',
        error: null,
      };
    case 'HANDOFF_REMOTE_START':
      return {
        ...state,
        status: 'SUBMITTING',
        error: null,
      };
    case 'HANDOFF_REMOTE_SUCCESS':
      return {
        ...state,
        status: 'WAITING_FOR_FRIEND',
        sessionId: action.payload.sessionId,
        error: null,
      };
    case 'START_PERSON_B':
      return {
        ...state,
        status: 'TAKING_QUIZ',
        friendPerson: 'B',
        answers: {},
        history: [],
        questionNum: 1,
        currentQ: action.payload.currentQ,
        upcomingQuestions: [],
        error: null,
      };
    case 'SUBMIT_START':
      return {
        ...state,
        status: 'SUBMITTING',
        error: null,
      };
    case 'COPY_LINK_SUCCESS':
      return { ...state, copied: true };
    case 'RESET_COPY_LINK':
      return { ...state, copied: false };
    case 'BACK': {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return {
        ...state,
        status: 'TAKING_QUIZ',
        history: state.history.slice(0, -1),
        currentQ: prev.question,
        questionNum: prev.questionNum,
        answers: prev.answers,
        upcomingQuestions: prev.upcoming,
        selectedOption: null,
        multiSelected: new Set(),
        error: null,
      };
    }
    default:
      return state;
  }
}

export function useQuizEngine() {
  return useReducer(quizReducer, initialState);
}
