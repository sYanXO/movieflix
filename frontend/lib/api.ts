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
  recommendations: Movie[];
  mood_profile: MoodProfile;
  merged_mood: string;
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

export function getNextQuestion(answers: Record<string, string>): Promise<QuestionResponse> {
  return post<QuestionResponse>('/api/question', { answers });
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
