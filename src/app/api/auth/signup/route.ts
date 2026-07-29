import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isSupabaseServiceRoleConfigured,
} from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const signupBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function isAlreadyRegistered(message: string): boolean {
  return /already registered|already exists|duplicate/i.test(message);
}

async function confirmExistingUser(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = createSupabaseAdminClient();
  const normalized = email.trim().toLowerCase();

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    return { ok: false, message: error.message };
  }

  const existing = data.users.find(
    (u) => u.email?.toLowerCase() === normalized,
  );
  if (!existing) {
    return { ok: false, message: "User already registered" };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    existing.id,
    { email_confirm: true, password },
  );
  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  return { ok: true };
}

export async function POST(req: Request) {
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      {
        error:
          "Signup is not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env (Supabase service_role key).",
      },
      { status: 503 },
    );
  }

  let body: z.infer<typeof signupBodySchema>;
  try {
    const json: unknown = await req.json();
    const parsed = signupBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, password } = body;
  const admin = createSupabaseAdminClient();

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (!isAlreadyRegistered(createError.message)) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 },
      );
    }

    const confirmed = await confirmExistingUser(email, password);
    if (!confirmed.ok) {
      return NextResponse.json({ error: confirmed.message }, { status: 400 });
    }
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return NextResponse.json({ error: signInError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
