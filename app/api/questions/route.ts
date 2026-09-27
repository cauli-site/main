import { NextRequest, NextResponse } from 'next/server'
import { addQuestion, deleteQuestion, listQuestions, markQuestionRead } from '@/lib/local-store'
const isAdmin = (request: NextRequest) => request.headers.get('x-cauli-admin-token') === process.env.CAULI_ADMIN_TOKEN
export async function POST(request: NextRequest) { const body = await request.json(); const message = typeof body.message === 'string' ? body.message.trim() : ''; if (!message || message.length > 1000) return NextResponse.json({ error: 'Write a message up to 1000 characters.' }, { status: 400 }); await addQuestion(message); return NextResponse.json({ ok: true }) }
export async function GET(request: NextRequest) { if (!isAdmin(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 }); return NextResponse.json({ questions: await listQuestions() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } }) }
export async function PATCH(request: NextRequest) { if (!isAdmin(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 }); const { id } = await request.json(); await markQuestionRead(Number(id)); return NextResponse.json({ ok: true }) }
export async function DELETE(request: NextRequest) { if (!isAdmin(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 }); const id = new URL(request.url).searchParams.get('id'); if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 }); await deleteQuestion(Number(id)); return NextResponse.json({ ok: true }) }
export const dynamic = 'force-dynamic'
