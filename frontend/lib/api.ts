const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

export interface QuestionResponse {
  question: string;
  options: string[];
  is_final: boolean;
  is_multi_select?: boolean;
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

export interface ClassifyQueryResponse {
  x: number;
  y: number;
  query: string;
}

export function getClassifyQuery(text: string): Promise<ClassifyQueryResponse> {
  return fetch(`${BASE}/api/classify-query?text=${encodeURIComponent(text)}`).then(res => {
    if (!res.ok) throw new Error('Failed to classify query');
    return res.json();
  });
}

// --- SessionRepository Data Layer ---

class StorageCache {
  private cache: Record<string, string> = {};
  
  getItem(key: string): string | null {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const val = sessionStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      // Ignore exception if sessionStorage is blocked
    }
    return this.cache[key] ?? null;
  }
  
  setItem(key: string, value: string): void {
    this.cache[key] = value;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, value);
      }
    } catch (e) {
      // Ignore
    }
  }

  removeItem(key: string): void {
    delete this.cache[key];
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(key);
      }
    } catch (e) {
      // Ignore
    }
  }

  clear(): void {
    this.cache = {};
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    } catch (e) {
      // Ignore
    }
  }
}

const storage = new StorageCache();

export const SessionRepository = {
  getAnswersA: (): Record<string, string> | null => {
    const data = storage.getItem('moodflix_answers_a');
    return data ? JSON.parse(data) : null;
  },
  setAnswersA: (answers: Record<string, string>) => {
    storage.setItem('moodflix_answers_a', JSON.stringify(answers));
  },
  
  getResults: (): RecommendResponse | FriendRecommendResponse | null => {
    const data = storage.getItem('moodflix_results');
    return data ? JSON.parse(data) : null;
  },
  setResults: (data: RecommendResponse | FriendRecommendResponse) => {
    storage.setItem('moodflix_results', JSON.stringify(data));
  },
  
  getAnswers: (): Record<string, string> | null => {
    const data = storage.getItem('moodflix_answers');
    return data ? JSON.parse(data) : null;
  },
  setAnswers: (answers: Record<string, string>) => {
    storage.setItem('moodflix_answers', JSON.stringify(answers));
  },

  isFriendMode: (): boolean => {
    return storage.getItem('moodflix_friend_mode') === 'true';
  },
  setFriendMode: (val: boolean) => {
    if (val) storage.setItem('moodflix_friend_mode', 'true');
    else storage.removeItem('moodflix_friend_mode');
  },
  
  getMergedMood: (): string | null => {
    return storage.getItem('moodflix_merged_mood');
  },
  setMergedMood: (mood: string) => {
    storage.setItem('moodflix_merged_mood', mood);
  },

  clearSession: () => {
    storage.clear();
  },

  /**
   * Finalizes the quiz for either a single user or a friend.
   * Encapsulates the logic for network fetching and session storage persistence.
   */
  async finalizeQuiz(
    answers: Record<string, string>,
    isFriendMode: boolean,
    friendPerson: 'A' | 'B',
    sessionId?: string | null
  ): Promise<void> {
    if (isFriendMode && friendPerson === 'B') {
      if (sessionId) {
        const data = await submitSession(sessionId, answers);
        this.setResults(data);
        this.setAnswers(answers);
        this.setFriendMode(true);
        this.setMergedMood(data.merged_mood ?? '');
      } else {
        const aAnswers = this.getAnswersA() ?? {};
        const data = await getFriendRecommendations(aAnswers, answers);
        this.setResults(data);
        this.setAnswers(answers);
        this.setFriendMode(true);
        this.setMergedMood(data.merged_mood ?? '');
      }
    } else {
      const data = await getRecommendations(answers);
      this.setResults(data);
      this.setAnswers(answers);
      this.setFriendMode(false);
    }
  },

  /**
   * Polls the remote session status.
   * Calls onComplete when the session is complete and results are stored.
   * Returns a cleanup function to cancel polling.
   */
  pollRemoteSession(sessionId: string, onComplete: () => void, intervalMs: number = 3000): () => void {
    let cancelled = false;
    
    const poll = async () => {
      if (cancelled) return;
      try {
        const session = await getSession(sessionId);
        if (session.is_complete) {
          this.setResults({
            recommendations: session.recommendations ?? [],
            mood_profile: session.mood_profile!,
            merged_mood: session.merged_mood ?? ''
          } as FriendRecommendResponse);
          this.setAnswers(session.answers_a);
          this.setFriendMode(true);
          this.setMergedMood(session.merged_mood ?? '');
          onComplete();
          return;
        }
      } catch (e) {
        console.error('Error polling session status:', e);
      }
      
      if (!cancelled) {
        setTimeout(poll, intervalMs);
      }
    };
    
    poll();
    
    return () => {
      cancelled = true;
    };
  }
};


