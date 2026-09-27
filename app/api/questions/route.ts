import { NextRequest, NextResponse } from 'next/server'
import { addQuestion, deleteQuestion, listQuestions, markQuestionRead } from '@/lib/local-store'

function authorized(request: NextRequest) {
  const expected = process.env.CAULI_ADMIN_TOKEN
  return Boolean(expected && request.headers.get('x-cauli-admin-token') === expected)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
  try {
    return NextResponse.json({ items: await listQuestions() })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Storage unavailable.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) {
      return NextResponse.json({ error: 'Invalid message.' }, { status: 400 })
    }
    await addQuestion(body.message.trim())
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Storage unavailable.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
  const id = Number((await request.json()).id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  try {
    await markQuestionRead(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Storage unavailable.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
  const id = Number(request.nextUrl.searchParams.get('id'))
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  try {
    await deleteQuestion(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Storage unavailable.' }, { status: 500 })
  }
}
