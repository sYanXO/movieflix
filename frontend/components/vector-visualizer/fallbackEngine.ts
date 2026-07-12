import { KEYWORD_MAPS } from './data';

// Singleton for the pipeline
let extractorInstance: any = null;

// Function to compute cosine similarity between two numeric arrays
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function computeFallbackCoordinates(text: string): Promise<{x: number, y: number}> {
  try {
    const { pipeline } = await import('@xenova/transformers');
    
    if (!extractorInstance) {
      // Load feature extraction pipeline
      extractorInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }

    const queryOutput = await extractorInstance(text, { pooling: 'mean', normalize: true });
    const queryEmb = Array.from(queryOutput.data) as number[];

    let targetX = 0;
    let targetY = 0;
    let totalWeight = 0;

    // We'll compute the embedding for each cluster's keywords
    for (const map of KEYWORD_MAPS) {
      const clusterText = map.keywords.join(" ");
      const clusterOutput = await extractorInstance(clusterText, { pooling: 'mean', normalize: true });
      const clusterEmb = Array.from(clusterOutput.data) as number[];
      
      const similarity = cosineSimilarity(queryEmb, clusterEmb);
      
      // If similarity is very low or negative, ignore it
      if (similarity > 0.1) {
        // We square or cube the similarity to exaggerate the pull of the closest matches
        const weight = Math.pow(similarity, 3);
        targetX += map.x * weight;
        targetY += map.y * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight > 0) {
      targetX = targetX / totalWeight;
      targetY = targetY / totalWeight;
    } else {
      // Deterministic pseudo-random center if completely unrelated
      const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      targetX = (seed % 7 - 3.5) / 10;
      targetY = (seed % 9 - 4.5) / 10;
    }

    return { x: targetX, y: targetY };
  } catch (err) {
    console.warn("Transformers.js fallback failed, using basic keyword matching", err);
    
    // Original Naive Keyword Matching
    const cleanText = text.toLowerCase();
    let targetX = 0;
    let targetY = 0;
    let totalWeight = 0;

    KEYWORD_MAPS.forEach((map) => {
      let weight = 0;
      map.keywords.forEach((keyword) => {
        if (cleanText.includes(keyword)) {
          weight += 1;
        }
      });

      if (weight > 0) {
        targetX += map.x * weight;
        targetY += map.y * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) {
      const seed = cleanText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      targetX = (seed % 7 - 3.5) / 10; 
      targetY = (seed % 9 - 4.5) / 10; 
    } else {
      targetX = targetX / totalWeight;
      targetY = targetY / totalWeight;
      const seed = cleanText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      targetX += ((seed % 10) - 5) / 150;
      targetY += (((seed >> 2) % 10) - 5) / 150;
    }

    return { x: targetX, y: targetY };
  }
}
