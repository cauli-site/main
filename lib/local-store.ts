import { MongoClient, type Collection, type Db } from 'mongodb'

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

type CounterRow = {
  _id: 'questions'
  value: number
}

type ContentDocument = ContentRow & { _id: string }
type QuestionDocument = QuestionRow & { _id: number }

let clientPromise: Promise<MongoClient> | undefined
let indexesPromise: Promise<void> | undefined

function getMongoUri() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not configured.')
  return uri
}

function getClient() {
  if (!clientPromise) {
    clientPromise = new MongoClient(getMongoUri()).connect()
  }
  return clientPromise
}

async function getDatabase(): Promise<Db> {
  const client = await getClient()
  const databaseName = process.env.MONGODB_DATABASE || new URL(getMongoUri()).pathname.slice(1) || 'cauli'
  return client.db(databaseName)
}

async function getCollections() {
  const db = await getDatabase()
  const content = db.collection<ContentDocument>('content')
  const questions = db.collection<QuestionDocument>('questions')
  const counters = db.collection<CounterRow>('counters')

  if (!indexesPromise) {
    indexesPromise = Promise.all([
      content.createIndex({ created_at: -1 }),
      questions.createIndex({ created_at: -1 }),
    ]).then(() => undefined)
  }
  await indexesPromise

  return { content, questions, counters }
}

export async function listContent() {
  const { content } = await getCollections()
  return content.find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray()
}

export async function upsertContent(row: Omit<ContentRow, 'created_at'>) {
  const { content } = await getCollections()
  const now = new Date().toISOString()
  const existing = await content.findOne({ _id: row.id }, { projection: { created_at: 1 } })

  await content.replaceOne(
    { _id: row.id },
    {
      _id: row.id,
      ...row,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    },
    { upsert: true },
  )
}

export async function deleteContent(id: string) {
  const { content } = await getCollections()
  const result = await content.deleteOne({ _id: id })
  return result.deletedCount
}

export async function listQuestions() {
  const { questions } = await getCollections()
  return questions.find({}, { projection: { _id: 0 } }).sort({ created_at: -1 }).toArray()
}

export async function addQuestion(message: string) {
  const { questions, counters } = await getCollections()
  const counter = await counters.findOneAndUpdate(
    { _id: 'questions' },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after' },
  )
  const id = counter?.value ?? 1

  await questions.insertOne({
    _id: id,
    id,
    message,
    created_at: new Date().toISOString(),
    read_at: null,
  })
}

export async function markQuestionRead(id: number) {
  const { questions } = await getCollections()
  await questions.updateOne({ _id: id }, { $set: { read_at: new Date().toISOString() } })
}

export async function deleteQuestion(id: number) {
  const { questions } = await getCollections()
  await questions.deleteOne({ _id: id })
}
