INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'ReRank',
  'User mood profile:\n%s\n\nI''ve found these candidate movies (sorted by vector similarity):\n%s\n\nRank the top 5 that best match the user''s mood. Avoid movies that conflict with dealbreakers.\nRespond ONLY with valid JSON (no markdown):\n{\n  "top_5": [\n    { "movie_id": 123, "title": "Movie Title", "score": 95 },\n    ...\n  ],\n  "reasoning": "Brief overall reasoning"\n}',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'Explain',
  'User answered:\n%s\n\nThis generated mood profile:\n%s\n\nMovie we''re explaining:\nTitle: %s\nPlot: %s\nGenres: %s\n\nWhy did we pick this? Respond in 1-2 sentences, casual and enthusiastic tone. No bullet points, just plain text.',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'MoodBreakdown',
  'Given this cinematic mood profile:\n%s\n\nScore 6-8 cinematic attributes as percentages (0-100) that describe this viewer''s taste.\nAlso assign a fun, evocative cinematic persona label (e.g. "The Brooding Auteur", "The Cozy Escapist", "The Adrenaline Junkie", "The Quiet Philosopher").\n\nChoose attributes relevant to the profile — examples: Thriller, Drama, Comedy, Action, Horror, Sci-Fi, Romance, Slow Burn, Fast Paced, Dark Tone, Light Tone, Thought-Provoking, Feel-Good, Edge-of-Seat, Emotional Depth, Visually Stunning.\n\nRespond ONLY with valid JSON (no markdown):\n{\n  "attributes": [\n    { "label": "Thriller", "score": 85 },\n    { "label": "Dark Tone", "score": 75 },\n    ...\n  ],\n  "persona": "The Brooding Auteur"\n}',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'MergeMoodProfiles',
  'Two friends want to watch a movie together. Here are their individual mood profiles:\n\nPerson A: %s\n\nPerson B: %s\n\nCreate a single MERGED mood profile that would satisfy BOTH people. Prioritize overlap. If they conflict, find a middle ground. Respect dealbreakers from BOTH — union of dealbreakers. Also write a short "merged_mood" string (e.g. "A tense thriller you can both get lost in") that captures the shared vibe.\n\nRespond ONLY with valid JSON (no markdown):\n{\n  "merged_mood": "A tense thriller you can both get lost in",\n  "profile": {\n    "mood": "...",\n    "pace": "fast|slow|any",\n    "tone": "...",\n    "ending": "happy|sad|dark|any",\n    "violence": "low|medium|high|none",\n    "focus_required": "full|background",\n    "genres": ["genre1", "genre2"],\n    "dealbreakers": [],\n    "keywords_to_boost": [],\n    "keywords_to_avoid": []\n  }\n}',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;
