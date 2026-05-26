import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Redirect back to home — works on any port
  const origin = req.nextUrl.origin;
  return NextResponse.redirect(`${origin}/`, { status: 302 });
}
