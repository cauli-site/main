import { NextRequest, NextResponse } from 'next/server'
import { deleteContent, listContent, upsertContent } from '@/lib/local-store'

function authorized(request: NextRequest) {
  const expected = process.env.CAULI_ADMIN_TOKEN
  return Boolean(expected && request.headers.get('x-cauli-admin-token') === expected)
}

export async function GET() {
  try {
    return NextResponse.json({ items: await listContent() })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Storage unavailable.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
  try {
    const body = await request.json()
    if (typeof body.id !== 'string' || typeof body.kind !== 'string' || !body.payload || typeof body.payload !== 'object') {
      return NextResponse.json({ error: 'Invalid content.' }, { status: 400 })
    }
    await upsertContent({ id: body.id, kind: body.kind, payload: body.payload })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Storage unavailable.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, deleted: await deleteContent(id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Storage unavailable.' }, { status: 500 })
  }
}
