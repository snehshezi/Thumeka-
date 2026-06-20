import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import type { DocumentRow } from "@/lib/database.types";
import { createSignedDocumentUrl } from "@/lib/storage-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const docRow = doc as DocumentRow;
  if (!docRow.file_url) {
    return NextResponse.json(
      { error: "Document has no attached file" },
      { status: 404 }
    );
  }

  const signedUrl = await createSignedDocumentUrl(docRow.file_url, 60);
  if (!signedUrl) {
    return NextResponse.json(
      { error: "Unable to generate document URL" },
      { status: 502 }
    );
  }

  // Light-touch audit trail — admin viewing of identity docs is worth a log.
  // We fire-and-forget so the redirect isn't delayed by the insert.
  void supabase.from("audit_logs").insert({
    actor_user_id: profile.id,
    actor_role: "admin",
    action: "document_viewed",
    entity_type: "document",
    entity_id: docRow.id,
    note: `Viewed ${docRow.document_type}`
  });

  return NextResponse.redirect(signedUrl, { status: 302 });
}
