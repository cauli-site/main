import { NextRequest, NextResponse } from 'next/server'
import { deleteContent, listContent, upsertContent } from '@/lib/local-store'

const isAdmin = (request: NextRequest) => request.headers.get('x-cauli-admin-token') === process.env.CAULI_ADMIN_TOKEN
export async function GET() { return NextResponse.json({ items: await listContent() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } }) }
export async function PUT(request: NextRequest) { if (!isAdmin(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 }); const body = await request.json(); const id = typeof body.id === 'string' ? body.id.slice(0, 120) : ''; const kind = typeof body.kind === 'string' ? body.kind : ''; if (!id || !['note', 'track', 'art', 'profile', 'decoration'].includes(kind)) return NextResponse.json({ error: 'Invalid content.' }, { status: 400 }); await upsertContent({ id, kind, payload: body.payload ?? {} }); return NextResponse.json({ ok: true }) }
export async function DELETE(request: NextRequest) { if (!isAdmin(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 }); const id = new URL(request.url).searchParams.get('id'); if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 }); return NextResponse.json({ ok: true, deleted: await deleteContent(id) }) }
export const dynamic = 'force-dynamic'
