export interface MovieNode {
  id: number;
  title: string;
  year: number;
  rating: number;
  genres: string[];
  x: number; // Normalized coordinate [-1, 1]
  y: number; // Normalized coordinate [-1, 1]
  description: string;
}

export const MOVIES_DATA: MovieNode[] = [
  // --- SCI-FI & CYBERPUNK (Center around -0.55, 0.40) ---
  { id: 1, title: 'Inception', year: 2010, rating: 8.8, genres: ['Sci-Fi', 'Action', 'Thriller'], x: -0.52, y: 0.38, description: 'A thief steals corporate secrets through the use of dream-sharing technology.' },
  { id: 2, title: 'Interstellar', year: 2014, rating: 8.7, genres: ['Sci-Fi', 'Drama', 'Adventure'], x: -0.62, y: 0.45, description: 'A team of explorers travel through a wormhole in search of a new home for humanity.' },
  { id: 3, title: 'The Matrix', year: 1999, rating: 8.7, genres: ['Sci-Fi', 'Action'], x: -0.48, y: 0.52, description: 'A computer hacker learns about the true nature of his reality and his role in the war against its controllers.' },
  { id: 4, title: 'Blade Runner 2049', year: 2017, rating: 8.0, genres: ['Sci-Fi', 'Drama', 'Mystery'], x: -0.58, y: 0.32, description: 'A new blade runner unearths a long-buried secret that could plunge what is left of society into chaos.' },
  { id: 5, title: 'Arrival', year: 2016, rating: 7.9, genres: ['Sci-Fi', 'Mystery', 'Drama'], x: -0.68, y: 0.42, description: 'A linguist works with the military to communicate with alien lifeforms who have arrived on Earth.' },
  { id: 6, title: 'Ex Machina', year: 2014, rating: 7.7, genres: ['Sci-Fi', 'Thriller', 'Drama'], x: -0.42, y: 0.46, description: 'A programmer is invited to administer a Turing test to an intelligent humanoid robot.' },
  { id: 7, title: 'Tenet', year: 2020, rating: 7.3, genres: ['Sci-Fi', 'Action', 'Thriller'], x: -0.50, y: 0.28, description: 'Armed with only one word, a protagonist fights for the survival of the entire world through time inversion.' },
  { id: 8, title: '2001: A Space Odyssey', year: 1968, rating: 8.3, genres: ['Sci-Fi', 'Adventure'], x: -0.72, y: 0.55, description: 'After uncovering a mysterious artifact buried beneath the Lunar surface, a spacecraft is sent to Jupiter.' },
  { id: 9, title: 'Coherence', year: 2013, rating: 7.2, genres: ['Sci-Fi', 'Thriller', 'Mystery'], x: -0.64, y: 0.30, description: 'Strange things begin to happen when a group of friends gather for a dinner party on the night of a comet passing.' },
  { id: 10, title: 'Contact', year: 1997, rating: 7.5, genres: ['Sci-Fi', 'Drama', 'Mystery'], x: -0.70, y: 0.34, description: 'Dr. Ellie Arroway races to interpret a radio signal sent by an alien civilization near Vega.' },

  // --- ROMANCE & MUSICALS (Center around 0.53, -0.52) ---
  { id: 11, title: 'The Notebook', year: 2004, rating: 7.8, genres: ['Romance', 'Drama'], x: 0.58, y: -0.52, description: 'A poor yet passionate young man falls in love with a rich young woman, giving her a sense of freedom.' },
  { id: 12, title: 'La La Land', year: 2016, rating: 8.0, genres: ['Romance', 'Comedy', 'Musical'], x: 0.48, y: -0.42, description: 'While navigating their careers in Los Angeles, a pianist and an actress fall in love.' },
  { id: 13, title: 'Before Sunrise', year: 1995, rating: 8.1, genres: ['Romance', 'Drama'], x: 0.64, y: -0.62, description: 'A young man and woman meet on a train in Europe, and wind up spending one evening together in Vienna.' },
  { id: 14, title: 'Pride & Prejudice', year: 2005, rating: 7.8, genres: ['Romance', 'Drama'], x: 0.70, y: -0.58, description: 'Sparks fly when spirited Elizabeth Bennet meets single, rich, and proud Mr. Darcy.' },
  { id: 15, title: 'Titanic', year: 1997, rating: 7.9, genres: ['Romance', 'Drama'], x: 0.52, y: -0.68, description: 'A seventeen-year-old aristocrat falls in love with a kind but poor artist aboard the luxurious, ill-fated ship.' },
  { id: 16, title: 'About Time', year: 2013, rating: 7.8, genres: ['Romance', 'Drama', 'Fantasy'], x: 0.56, y: -0.48, description: 'At the age of 21, Tim discovers he can travel in time and change what happens in his own life.' },
  { id: 17, title: 'Amélie', year: 2001, rating: 8.3, genres: ['Romance', 'Comedy'], x: 0.44, y: -0.48, description: 'Amélie is an innocent and naive girl in Paris with her own sense of justice. She decides to help those around her.' },
  { id: 18, title: 'Her', year: 2013, rating: 8.0, genres: ['Romance', 'Sci-Fi', 'Drama'], x: 0.42, y: -0.32, description: 'In a near future, a lonely writer develops an unlikely relationship with an operating system.' },
  { id: 19, title: 'Before Sunset', year: 2004, rating: 8.1, genres: ['Romance', 'Drama'], x: 0.66, y: -0.66, description: 'Nine years after their random meeting, Jesse and Celine cross paths again in Paris.' },
  { id: 20, title: 'About a Boy', year: 2002, rating: 7.1, genres: ['Romance', 'Comedy', 'Drama'], x: 0.40, y: -0.40, description: 'A cynical, immature young man is taught how to act like an adult by a boy.' },

  // --- ACTION & BLOCKBUSTERS (Center around -0.58, -0.38) ---
  { id: 21, title: 'Die Hard', year: 1988, rating: 8.2, genres: ['Action', 'Thriller'], x: -0.62, y: -0.38, description: 'An NYPD officer tries to save his wife and several others taken hostage by German terrorists during a Christmas party.' },
  { id: 22, title: 'Mad Max: Fury Road', year: 2015, rating: 8.1, genres: ['Action', 'Sci-Fi', 'Adventure'], x: -0.72, y: -0.46, description: 'In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler in search for her homeland.' },
  { id: 23, title: 'Gladiator', year: 2000, rating: 8.5, genres: ['Action', 'Drama', 'Adventure'], x: -0.50, y: -0.42, description: 'A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family.' },
  { id: 24, title: 'The Dark Knight', year: 2008, rating: 9.0, genres: ['Action', 'Crime', 'Drama'], x: -0.56, y: -0.30, description: 'When the menace known as the Joker wreaks havoc and chaos on Gotham, Batman must accept his greatest psychological test.' },
  { id: 25, title: 'John Wick', year: 2014, rating: 7.4, genres: ['Action', 'Thriller'], x: -0.68, y: -0.32, description: 'An ex-hit-man comes out of retirement to track down the gangsters that took everything from him.' },
  { id: 26, title: 'Terminator 2: Judgment Day', year: 1991, rating: 8.6, genres: ['Action', 'Sci-Fi'], x: -0.58, y: -0.54, description: 'A cyborg, identical to the one who failed to kill Sarah Connor, must now protect her ten-year-old son John.' },
  { id: 27, title: 'Kill Bill: Vol. 1', year: 2003, rating: 8.2, genres: ['Action', 'Thriller'], x: -0.46, y: -0.52, description: 'After awakening from a four-year coma, a former assassin wreaks vengeance on the team that betrayed her.' },
  { id: 28, title: 'Speed', year: 1994, rating: 7.3, genres: ['Action', 'Thriller'], x: -0.64, y: -0.24, description: 'A young SWAT cop must prevent a bomb exploding aboard a city bus by keeping its speed above 50 mph.' },
  { id: 29, title: 'Raiders of the Lost Ark', year: 1981, rating: 8.4, genres: ['Action', 'Adventure'], x: -0.48, y: -0.36, description: 'Archaeology professor Indiana Jones ventures to find the biblical Ark of the Covenant before the Nazis can seize it.' },
  { id: 30, title: 'Mission: Impossible - Fallout', year: 2018, rating: 7.7, genres: ['Action', 'Thriller'], x: -0.74, y: -0.36, description: 'Ethan Hunt and his IMF team, along with some familiar allies, race against time after a mission goes wrong.' },

  // --- COMEDY & SATIRE (Center around 0.48, 0.45) ---
  { id: 31, title: 'Superbad', year: 2007, rating: 7.6, genres: ['Comedy'], x: 0.48, y: 0.52, description: 'Two co-dependent high school seniors are forced to deal with separation anxiety after their plan to stage a booze-soaked party goes awry.' },
  { id: 32, title: 'The Hangover', year: 2009, rating: 7.7, genres: ['Comedy'], x: 0.58, y: 0.46, description: 'Three buddies wake up from a bachelor party in Las Vegas, with no memory of the previous night and the bachelor missing.' },
  { id: 33, title: 'Dumb and Dumber', year: 1994, rating: 7.3, genres: ['Comedy'], x: 0.64, y: 0.58, description: 'After a woman leaves a briefcase at the airport terminal, two dim-witted friends go on a road trip to Aspen to return it.' },
  { id: 34, title: 'Anchorman: The Legend of Ron Burgundy', year: 2004, rating: 7.1, genres: ['Comedy'], x: 0.52, y: 0.42, description: 'Ron Burgundy is San Diego\'s top-rated newsman in the male-dominated 1970s broadcast journalism.' },
  { id: 35, title: 'Step Brothers', year: 2008, rating: 6.9, genres: ['Comedy'], x: 0.62, y: 0.38, description: 'Two middle-aged, conversationally immature men still living at home are forced to become roommates when their parents marry.' },
  { id: 36, title: 'Shaun of the Dead', year: 2004, rating: 7.9, genres: ['Comedy', 'Horror'], x: 0.42, y: 0.36, description: 'A man\'s uneventful life is disrupted by the zombie apocalypse, forcing him to rise to the occasion and save his friends.' },
  { id: 37, title: 'Mean Girls', year: 2004, rating: 7.1, genres: ['Comedy'], x: 0.38, y: 0.46, description: 'Cady Heron is a hit with The Plastics, the A-list girl clique at her new school, until she makes the mistake of falling for Aaron Samuels.' },
  { id: 38, title: 'Booksmart', year: 2019, rating: 7.1, genres: ['Comedy'], x: 0.34, y: 0.54, description: 'On the eve of their high school graduation, two academic superstars realize they should have worked less and played more.' },
  { id: 39, title: 'The Grand Budapest Hotel', year: 2014, rating: 8.1, genres: ['Comedy', 'Drama'], x: 0.32, y: 0.34, description: 'A writer relates his adventures at a renowned European resort hotel between the first and second World Wars.' },
  { id: 40, title: 'Tropic Thunder', year: 2008, rating: 7.1, genres: ['Comedy', 'Action'], x: 0.46, y: 0.28, description: 'Through a series of freak occurrences, a group of actors shooting a big-budget war movie are forced to become the soldiers they are portraying.' },

  // --- HORROR & THRILLERS (Center around -0.18, -0.66) ---
  { id: 41, title: 'The Conjuring', year: 2013, rating: 7.5, genres: ['Horror', 'Mystery'], x: -0.12, y: -0.64, description: 'Paranormal investigators Ed and Lorraine Warren work to help a family terrorized by a dark presence in their farmhouse.' },
  { id: 42, title: 'Hereditary', year: 2018, rating: 7.3, genres: ['Horror', 'Drama', 'Mystery'], x: -0.18, y: -0.72, description: 'A grieving family is haunted by tragic and disturbing occurrences after the death of their secretive grandmother.' },
  { id: 43, title: 'Get Out', year: 2017, rating: 7.8, genres: ['Horror', 'Mystery', 'Thriller'], x: -0.06, y: -0.52, description: 'A young African-American visits his white girlfriend\'s parents for the weekend, where his simmering uneasiness reaches a boiling point.' },
  { id: 44, title: 'A Quiet Place', year: 2018, rating: 7.5, genres: ['Horror', 'Sci-Fi', 'Drama'], x: -0.24, y: -0.58, description: 'A family struggles for survival in a world where most humans have been killed by blind but noise-sensitive creatures.' },
  { id: 45, title: 'The Shining', year: 1980, rating: 8.4, genres: ['Horror', 'Drama'], x: -0.28, y: -0.68, description: 'A family heads to an isolated hotel for the winter where a sinister presence influences the father into violence.' },
  { id: 46, title: 'Alien', year: 1979, rating: 8.5, genres: ['Horror', 'Sci-Fi'], x: -0.36, y: -0.48, description: 'The crew of a commercial spacecraft encounter a deadly lifeform after investigating an unknown transmission.' },
  { id: 47, title: 'Psycho', year: 1960, rating: 8.5, genres: ['Horror', 'Thriller', 'Mystery'], x: -0.08, y: -0.76, description: 'A Phoenix secretary embezzles $40,000 from her employer\'s client, goes on the run, and checks into a remote motel.' },
  { id: 48, title: 'Midsommar', year: 2019, rating: 7.1, genres: ['Horror', 'Drama', 'Mystery'], x: -0.22, y: -0.78, description: 'A couple travels to Scandinavia to visit a rural hometown\'s fabled midsummer festival, which turns into a cultish nightmare.' },
  { id: 49, title: 'Halloween', year: 1978, rating: 7.7, genres: ['Horror', 'Thriller'], x: -0.02, y: -0.68, description: 'Fifteen years after murdering his sister on Halloween night, Michael Myers escapes from a mental hospital and returns to Haddonfield.' },
  { id: 50, title: 'The Thing', year: 1982, rating: 8.2, genres: ['Horror', 'Sci-Fi', 'Mystery'], x: -0.32, y: -0.58, description: 'A research team in Antarctica is hunted by a shape-shifting alien that assumes the appearance of its victims.' },

  // --- DRAMA & CLASSICS (Center around 0.10, 0.62) ---
  { id: 51, title: 'The Godfather', year: 1972, rating: 9.2, genres: ['Drama', 'Crime'], x: 0.12, y: 0.68, description: 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.' },
  { id: 52, title: 'Pulp Fiction', year: 1994, rating: 8.9, genres: ['Drama', 'Crime'], x: -0.04, y: 0.52, description: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales.' },
  { id: 53, title: 'The Shawshank Redemption', year: 1994, rating: 9.3, genres: ['Drama'], x: 0.18, y: 0.74, description: 'Over the course of several years, two convicts form a friendship, seeking consolation and, eventually, redemption.' },
  { id: 54, title: 'Schindler\'s List', year: 1993, rating: 9.0, genres: ['Drama', 'Biography', 'History'], x: 0.06, y: 0.82, description: 'In German-occupied Poland during WWII, industrialist Oskar Schindler gradually becomes concerned for his Jewish workforce.' },
  { id: 55, title: 'Forrest Gump', year: 1994, rating: 8.8, genres: ['Drama', 'Romance'], x: 0.24, y: 0.62, description: 'The history of the United States from the 1950s to the \'70s unfolds from the perspective of an Alabama man with an IQ of 75.' },
  { id: 56, title: 'Good Will Hunting', year: 1997, rating: 8.3, genres: ['Drama', 'Romance'], x: 0.28, y: 0.54, description: 'Will Hunting, a janitor at MIT, has a gift for mathematics, but needs help from a psychologist to find direction.' },
  { id: 57, title: 'Whiplash', year: 2014, rating: 8.5, genres: ['Drama', 'Music'], x: 0.08, y: 0.58, description: 'A promising young drummer enrolls at a cut-throat music conservatory where his dreams of greatness are mentored by an abusive instructor.' },
  { id: 58, title: 'Parasite', year: 2019, rating: 8.5, genres: ['Drama', 'Thriller', 'Comedy'], x: -0.08, y: 0.62, description: 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.' },
  { id: 59, title: 'Fight Club', year: 1999, rating: 8.8, genres: ['Drama'], x: -0.10, y: 0.44, description: 'An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into something much more.' },
  { id: 60, title: 'The Truman Show', year: 1998, rating: 8.2, genres: ['Drama', 'Comedy'], x: 0.16, y: 0.48, description: 'An insurance salesman discovers his whole life is actually a reality TV show.' }
];

export interface ClusterInfo {
  name: string;
  centerX: number;
  centerY: number;
  radius: number;
  color: string;
  glowColor: string;
  borderColor: string;
}

export const CLUSTERS: ClusterInfo[] = [
  { name: 'Sci-Fi Space & Concepts', centerX: -0.55, centerY: 0.40, radius: 0.26, color: 'rgba(168, 85, 247, 0.03)', glowColor: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.35)' },
  { name: 'Romance & Relationships', centerX: 0.53, centerY: -0.52, radius: 0.24, color: 'rgba(236, 72, 153, 0.03)', glowColor: 'rgba(236, 72, 153, 0.12)', borderColor: 'rgba(236, 72, 153, 0.35)' },
  { name: 'Action & Thrillers', centerX: -0.58, centerY: -0.38, radius: 0.24, color: 'rgba(245, 158, 11, 0.03)', glowColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)' },
  { name: 'Comedy & Satire', centerX: 0.48, centerY: 0.45, radius: 0.24, color: 'rgba(16, 185, 129, 0.03)', glowColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.35)' },
  { name: 'Horror & Paranormal', centerX: -0.18, centerY: -0.66, radius: 0.22, color: 'rgba(239, 68, 68, 0.03)', glowColor: 'rgba(239, 68, 68, 0.10)', borderColor: 'rgba(239, 68, 68, 0.30)' },
  { name: 'Human Drama & Classics', centerX: 0.10, centerY: 0.62, radius: 0.25, color: 'rgba(59, 130, 246, 0.03)', glowColor: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.35)' }
];

export const SAMPLE_QUERIES = [
  { label: '🚀 Mind-bending space voyage', text: 'A mind-bending puzzle in deep space involving time and wormholes' },
  { label: '💖 Cry my eyes out romance', text: 'Tear-jerking beautiful romantic drama about soulmates meeting by chance' },
  { label: '💥 High-octane action ride', text: 'Exciting fast-paced car chase shooter and explosion filled action thriller' },
  { label: '🍿 Laugh out loud comedy', text: 'Hilarious silly comedy with friends behaving dumbly and making jokes' },
  { label: '👻 Paranormal scary ghosts', text: 'Spooky terrifying ghost haunting in a creepy dark house horror film' }
];

export const KEYWORD_MAPS = [
  { keywords: ['space', 'sci-fi', 'future', 'robot', 'galaxy', 'stellar', 'matrix', 'time', 'dimension', 'mind', 'puzzle', 'tech', 'alien', 'wormhole', 'dream'], x: -0.55, y: 0.40 },
  { keywords: ['love', 'romance', 'heart', 'date', 'relationship', 'musical', 'singer', 'tears', 'soulmate', 'notebook', 'beautiful', 'kiss', 'fall', 'sweet'], x: 0.53, y: -0.52 },
  { keywords: ['action', 'fight', 'gun', 'explosion', 'shoot', 'car', 'race', 'hero', 'war', 'battle', 'vengeance', 'kill', 'die', 'thriller', 'officer', 'chase'], x: -0.58, y: -0.38 },
  { keywords: ['comedy', 'funny', 'laugh', 'hilarious', 'joke', 'satire', 'fun', 'friends', 'silly', 'dumb', 'hangover', 'party', 'humor', 'lol'], x: 0.48, y: 0.45 },
  { keywords: ['horror', 'scary', 'ghost', 'spooky', 'fear', 'monster', 'blood', 'creepy', 'dead', 'haunt', 'dark', 'evil', 'shining', 'cult', 'witch'], x: -0.18, y: -0.66 },
  { keywords: ['drama', 'classic', 'life', 'deep', 'serious', 'family', 'crime', 'mafia', 'history', 'oscar', 'academy', 'sadness', 'emotional', 'genius'], x: 0.10, y: 0.62 }
];
