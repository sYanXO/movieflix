const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export interface QuestionResponse {
  question: string;
  options: string[];
  is_final: boolean;
}

export interface Movie {
  id: number;
  tmdb_id: number;
  title: string;
  year: number;
  overview: string;
  genres: string[];
  keywords: string[];
  runtime: number;
  language: string;
  rating: number;
  poster_url: string;
}

export interface MoodProfile {
  mood: string;
  pace: string;
  tone: string;
  ending: string;
  violence: string;
  focus_required: string;
  genres: string[];
  dealbreakers: string[];
  keywords_to_boost: string[];
  keywords_to_avoid: string[];
}

export interface RecommendResponse {
  session_id?: string;
  recommendations: Movie[];
  mood_profile: MoodProfile;
}

export interface MoodAttribute {
  label: string;
  score: number; // 0-100
}

export interface MoodBreakdownResponse {
  attributes: MoodAttribute[];
  persona: string;
}

export interface FriendRecommendResponse {
  session_id?: string;
  recommendations: Movie[];
  mood_profile: MoodProfile;
  merged_mood: string;
}

export interface SessionResponse {
  id: string;
  answers_a: Record<string, string>;
  answers_b: Record<string, string>;
  merged_mood?: string;
  mood_profile?: MoodProfile;
  recommendations?: Movie[];
  is_complete: boolean;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  return res.json();
}

export interface GenerateQuizResponse {
  questions: QuestionResponse[];
}

export function generateAdaptiveQuiz(starterAnswer: string): Promise<GenerateQuizResponse> {
  return post<GenerateQuizResponse>('/api/generate-quiz', { starter_answer: starterAnswer });
}

export function getRecommendations(answers: Record<string, string>): Promise<RecommendResponse> {
  return post<RecommendResponse>('/api/recommend', { answers });
}

export function getFriendRecommendations(
  answersA: Record<string, string>,
  answersB: Record<string, string>
): Promise<FriendRecommendResponse> {
  return post<FriendRecommendResponse>('/api/recommend-friends', { answers_a: answersA, answers_b: answersB });
}

export function getMoodBreakdown(moodProfile: MoodProfile): Promise<MoodBreakdownResponse> {
  return post<MoodBreakdownResponse>('/api/mood-breakdown', { mood_profile: moodProfile });
}

export function getExplanation(
  movieId: number,
  moodProfile: MoodProfile,
  userAnswers: Record<string, string>
): Promise<{ explanation: string }> {
  return post('/api/explain', {
    movie_id: movieId,
    mood_profile: moodProfile,
    user_answers: userAnswers,
  });
}

export function createSession(answersA: Record<string, string>): Promise<{ session_id: string }> {
  return post('/api/sessions', { answers_a: answersA });
}

export function getSession(sessionId: string): Promise<SessionResponse> {
  return fetch(`${BASE}/api/sessions/${sessionId}`).then(res => {
    if (!res.ok) throw new Error('Failed to fetch session');
    return res.json();
  });
}

export function submitSession(
  sessionId: string,
  answersB: Record<string, string>
): Promise<FriendRecommendResponse> {
  return post(`/api/sessions/${sessionId}/submit`, { answers_b: answersB });
}

export function rateSession(
  sessionId: string,
  rating: number,
  userNotes: string
): Promise<{ status: string }> {
  return patch(`/api/sessions/${sessionId}/rating`, { rating, user_notes: userNotes });
}

