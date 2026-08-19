import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateAuth } from './server/validate-auth'

const protectedRoutes = [
  '/dashboard',
  '/dashboard/profile',
  '/dashboard/transcribe',
]

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => pathname.startsWith(route))
}

export async function proxy(request: NextRequest) {
  const { valid } = await validateAuth()
  const { pathname } = request.nextUrl

  if (isProtectedRoute(pathname) && !valid) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  if (request.nextUrl.pathname === '/auth' && valid) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
