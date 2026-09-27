import { MongoClient, type Collection } from 'mongodb'

type ContentRow = {
  id: string
  kind: string
  payload: Record<string, unknown>
  created_at: string
  updated_at?: string
}

type QuestionRow = {
  id: number
  message: string
  created_at: string
  read_at: string | null
}

type MongoState = {
  client: MongoClient
  content: Collection<ContentRow>
  questions: Collection<QuestionRow>
}

const uri = process.env.MONGODB_URI

if (!uri) throw new Error('MONGODB_URI is not configured.')

const globalForMongo = globalThis as typeof globalThis & { cauliMongo?: Promise<MongoState> }

async function getState(): Promise<MongoState> {
  if (!globalForMongo.cauliMongo) {
    globalForMongo.cauliMongo = (async () => {
      const client = new MongoClient(uri)
      await client.connect()
      const database = client.db('cauli')
      return {
        client,
        content: database.collection<ContentRow>('content'),
        questions: database.collection<QuestionRow>('questions'),
      }
    })()
  }
  return globalForMongo.cauliMongo
}

export async function listContent() {
  const { content } = await getState()
  return content.find({}).sort({ created_at: -1 }).toArray()
}

export async function upsertContent(row: Omit<ContentRow, 'created_at'>) {
  const { content } = await getState()
  const now = new Date().toISOString()
  await content.updateOne(
    { id: row.id },
    { $set: { ...row, updated_at: now }, $setOnInsert: { created_at: now } },
    { upsert: true },
  )
}

export async function deleteContent(id: string) {
  const { content } = await getState()
  const result = await content.deleteOne({ id })
  return result.deletedCount
}

export async function listQuestions() {
  const { questions } = await getState()
  return questions.find({}).sort({ created_at: -1 }).toArray()
}

export async function addQuestion(message: string) {
  const { questions } = await getState()
  const latest = await questions.findOne({}, { sort: { id: -1 }, projection: { id: 1 } })
  await questions.insertOne({
    id: (latest?.id ?? 0) + 1,
    message,
    created_at: new Date().toISOString(),
    read_at: null,
  })
}

export async function markQuestionRead(id: number) {
  const { questions } = await getState()
  await questions.updateOne({ id }, { $set: { read_at: new Date().toISOString() } })
}

export async function deleteQuestion(id: number) {
  const { questions } = await getState()
  await questions.deleteOne({ id })
}

export async function ensureIndexes() {
  const { content, questions } = await getState()
  await Promise.all([content.createIndex({ id: 1 }, { unique: true }), questions.createIndex({ id: 1 }, { unique: true })])
}

void ensureIndexes()
  .catch(() => undefined)
  .finally(() => undefined)
