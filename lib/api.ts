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
