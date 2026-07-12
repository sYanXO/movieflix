CREATE TABLE IF NOT EXISTS prompts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  version INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

-- Ensure only one active prompt per name
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_prompt ON prompts (name) WHERE status = 'active';

-- Seed the initial prompts
INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'GenerateAdaptiveQuiz',
  'The user was asked: "How would you describe your week so far?"\nThey answered: "%s"\n\nGenerate exactly 3 highly creative, personalized, multi-choice questions to narrow down what movie they should watch. \nEach question should have 3-4 options. \n\nRespond ONLY with valid JSON (no markdown):\n[\n  {\n    "question": "exact question text",\n    "options": ["option1", "option2", ...],\n    "is_final": false\n  },\n  ...\n]',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;

INSERT INTO prompts (name, content, version, status, notes) VALUES (
  'ParseMoodProfile',
  'The user answered these questions about their movie mood:\n%s\n\nRespond ONLY with JSON (no markdown):\n{\n  "mood": "short description of overall vibe",\n  "pace": "fast|slow|any",\n  "tone": "light|dark|gritty|uplifting|tense|scary|etc",\n  "ending": "happy|sad|dark|any",\n  "violence": "low|medium|high|none",\n  "focus_required": "full|background",\n  "genres": ["genre1", "genre2"],\n  "dealbreakers": ["gore", "romance"] or [],\n  "keywords_to_boost": ["heist", "psychological"],\n  "keywords_to_avoid": []\n}',
  1,
  'active',
  'Initial version from source code'
) ON CONFLICT (name) WHERE status = 'active' DO NOTHING;
