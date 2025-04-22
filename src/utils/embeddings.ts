// Generate Input Embeddings using Gemini API
async function generateEmbeddings(
  apiKey: string,
  text: string[],
): Promise<number[][]> {
  // const EMBED_MODEL = "gemini-embedding-exp-03-07";
  const EMBED_MODEL = "text-embedding-004";
  const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
  const embeddings = [];

  try {
    const response = await fetch(`${API_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }],
        },
      }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    console.log("Embedding response:", data);
    embeddings.push(data.embedding.values);
  } catch (error) {
    console.error("Embedding generation failed:", error);
    throw error;
  }
  return embeddings;
}

// Cosine Similarity Function
function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new Error("Inputs must be arrays.");
  }

  if (a.length !== b.length) {
    throw new Error("Input arrays must have the same length.");
  }
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));

  // Prevent division by zero
  if (normA === 0 || normB === 0) return 0;

  return dot / (normA * normB);
}

// Type Definitions for Embeddings
export type EmbeddingVector = {
  id: string;
  embedding: number[];
};

export type EmbeddingsData = {
  vectors: EmbeddingVector[];
};

export interface EmbeddingItem {
  id: string;
  text: string;
  embedding: number[];
}

// Load Embeddings from File
export async function loadEmbeddings(
  pathToEmbeddedData: string,
): Promise<EmbeddingItem[]> {
  const response = await fetch(pathToEmbeddedData);
  if (!response.ok) {
    throw new Error(
      `Failed to load file at ${pathToEmbeddedData}: HTTP ${response.status}`,
    );
  }

  const jsonData = await response.json();

  if (!Array.isArray(jsonData)) {
    throw new Error("Invalid JSON format: expected an array");
  }

  for (const item of jsonData) {
    if (
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      typeof item.text !== "string" ||
      !Array.isArray(item.embedding) ||
      !item.embedding.every((n: any) => typeof n === "number")
    ) {
      throw new Error(`Invalid item format: ${JSON.stringify(item, null, 2)}`);
    }
  }

  return jsonData as EmbeddingItem[];
}

// Generate Input Embeddings using Gemini API
async function embedInput(apiKey: any, text: any) {
  return await generateEmbeddings(apiKey, text);
}

// Semantic Search
export async function findBestMatch(
  apiKey: string,
  query: string,
  embeddings: EmbeddingItem[],
): Promise<EmbeddingItem & { score: number }> {
  const queryVector = (await embedInput(apiKey, query))[0]; // Flatten to number[]

  const scoredChunks = embeddings.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryVector, chunk.embedding),
  }));

  scoredChunks.sort((a, b) => b.score - a.score);
  console.log("Scored Chunks:", scoredChunks);

  return scoredChunks[0];
}
