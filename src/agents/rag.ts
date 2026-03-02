import OpenAI from "openai";
import { ChromaClient } from "chromadb";

const openai = new OpenAI();
const COLLECTION_NAME = "proposals";
const EMBEDDING_MODEL = "text-embedding-3-small";

function getChroma(): ChromaClient {
  return new ChromaClient({ path: process.env.CHROMA_URL ?? "http://localhost:8002" });
}

async function getCollection() {
  const chroma = getChroma();
  return chroma.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { "hnsw:space": "cosine" },
  });
}

async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return response.data[0].embedding;
}

// Embed text and upsert into ChromaDB
export async function embedAndStore(
  id: string,
  text: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const embedding = await embed(text);
  const collection = await getCollection();
  await collection.upsert({
    ids: [id],
    embeddings: [embedding],
    metadatas: [metadata as Record<string, string | number | boolean>],
    documents: [text],
  });
}

// Retrieve top-k similar documents for a query
export async function retrieve(
  query: string,
  topK = 5
): Promise<{ id: string; text: string; metadata: Record<string, unknown> }[]> {
  const collection = await getCollection();
  const count = await collection.count();
  if (count === 0) return [];

  const embedding = await embed(query);
  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults: Math.min(topK, count),
    include: ["documents", "metadatas", "distances"] as any,
  });

  return (results.ids[0] ?? []).map((id, i) => ({
    id,
    text: results.documents?.[0]?.[i] ?? "",
    metadata: (results.metadatas?.[0]?.[i] ?? {}) as Record<string, unknown>,
  }));
}
