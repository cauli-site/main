const GITHUB_API = 'https://api.github.com'
const DATA_PATH = 'data/cauli-local.json'
const OWNER = process.env.GITHUB_OWNER || 'cauli-site'
const REPO = process.env.GITHUB_REPO || 'main'
const BRANCH = process.env.GITHUB_BRANCH || 'main'
const TOKEN = process.env.GITHUB_TOKEN

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

type Store = {
  content: ContentRow[]
  questions: QuestionRow[]
  nextQuestionId: number
}

type GitHubFile = {
  content?: string
  sha?: string
}

const emptyStore: Store = {
  content: [],
  questions: [],
  nextQuestionId: 1,
}

function assertConfig() {
  if (!TOKEN) {
    throw new Error('GITHUB_TOKEN is not configured.')
  }
}

function fileUrl() {
  return `${GITHUB_API}/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${DATA_PATH}`
}

function headers() {
  assertConfig()
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'cauli-fan-site',
    'Content-Type': 'application/json',
  }
}

function normalizeStore(value: unknown): Store {
  if (!value || typeof value !== 'object') return structuredClone(emptyStore)

  const source = value as Partial<Store>
  return {
    content: Array.isArray(source.content) ? source.content : [],
    questions: Array.isArray(source.questions) ? source.questions : [],
    nextQuestionId:
      typeof source.nextQuestionId === 'number' && Number.isFinite(source.nextQuestionId)
        ? source.nextQuestionId
        : 1,
  }
}

async function getFile(): Promise<{ store: Store; sha: string | null }> {
  const response = await fetch(`${fileUrl()}?ref=${encodeURIComponent(BRANCH)}`, {
    method: 'GET',
    headers: headers(),
    cache: 'no-store',
  })

  if (response.status === 404) {
    return { store: structuredClone(emptyStore), sha: null }
  }

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`GitHub read failed (${response.status}): ${details}`)
  }

  const file = (await response.json()) as GitHubFile
  if (!file.content) return { store: structuredClone(emptyStore), sha: file.sha ?? null }

  const json = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8')
  return { store: normalizeStore(JSON.parse(json)), sha: file.sha ?? null }
}

async function saveFile(store: Store, sha: string | null, message: string) {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(`${JSON.stringify(store, null, 2)}\n`, 'utf8').toString('base64'),
    branch: BRANCH,
  }

  if (sha) body.sha = sha

  const response = await fetch(fileUrl(), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    const details = await response.text()
    const error = new Error(`GitHub write failed (${response.status}): ${details}`)
    ;(error as Error & { status?: number }).status = response.status
    throw error
  }
}

async function load(): Promise<Store> {
  return (await getFile()).store
}

async function updateStore(
  mutate: (store: Store) => void,
  message: string,
) {
  // A short retry handles two requests arriving at nearly the same time.
  // If GitHub rejects a stale SHA with 409, reload the newest file and apply
  // the same mutation again instead of losing the other request's changes.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { store, sha } = await getFile()
    mutate(store)

    try {
      await saveFile(store, sha, message)
      return
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      if (status !== 409 || attempt === 2) throw error
    }
  }
}

export async function listContent() {
  return (await load()).content.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function upsertContent(row: Omit<ContentRow, 'created_at'>) {
  await updateStore((store) => {
    const now = new Date().toISOString()
    const existing = store.content.findIndex((item) => item.id === row.id)
    const next = {
      ...row,
      created_at: existing >= 0 ? store.content[existing].created_at : now,
      updated_at: now,
    }

    if (existing >= 0) store.content[existing] = next
    else store.content.push(next)
  }, `Update content: ${row.id}`)
}

export async function deleteContent(id: string) {
  let deleted = 0

  await updateStore((store) => {
    const before = store.content.length
    store.content = store.content.filter((item) => item.id !== id)
    deleted = before - store.content.length
  }, `Delete content: ${id}`)

  return deleted
}

export async function listQuestions() {
  return (await load()).questions.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function addQuestion(message: string) {
  await updateStore((store) => {
    store.questions.push({
      id: store.nextQuestionId++,
      message,
      created_at: new Date().toISOString(),
      read_at: null,
    })
  }, 'Add question')
}

export async function markQuestionRead(id: number) {
  await updateStore((store) => {
    const item = store.questions.find((question) => question.id === id)
    if (item) item.read_at = new Date().toISOString()
  }, `Mark question ${id} as read`)
}

export async function deleteQuestion(id: number) {
  await updateStore((store) => {
    store.questions = store.questions.filter((question) => question.id !== id)
  }, `Delete question: ${id}`)
}
