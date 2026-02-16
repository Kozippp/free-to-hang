import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing Authorization header" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(500, { error: "Supabase environment is not configured" });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const payload = await req.json().catch(() => null);
    const pollId = payload?.pollId;
    const optionIdsRaw = payload?.optionIds;

    if (typeof pollId !== "string" || !pollId) {
      return jsonResponse(400, { error: "pollId is required" });
    }
    if (!Array.isArray(optionIdsRaw)) {
      return jsonResponse(400, { error: "optionIds must be an array" });
    }

    const optionIds = Array.from(
      new Set(optionIdsRaw.filter((value: unknown) => typeof value === "string" && value.length > 0)),
    ) as string[];

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const { data: poll, error: pollError } = await supabase
      .from("plan_polls")
      .select("id, plan_id")
      .eq("id", pollId)
      .single();

    if (pollError || !poll) {
      return jsonResponse(404, { error: "Poll not found" });
    }

    const { data: participant, error: participantError } = await supabase
      .from("plan_participants")
      .select("status")
      .eq("plan_id", poll.plan_id)
      .eq("user_id", user.id)
      .single();

    if (participantError || !participant || participant.status !== "going") {
      return jsonResponse(403, { error: "Only going participants can vote" });
    }

    if (optionIds.length > 0) {
      const { data: existingOptions, error: optionsError } = await supabase
        .from("plan_poll_options")
        .select("id")
        .eq("poll_id", pollId)
        .in("id", optionIds);

      if (optionsError) {
        return jsonResponse(400, { error: optionsError.message });
      }

      const existingOptionIds = new Set((existingOptions ?? []).map((row: { id: string }) => row.id));
      const invalidOption = optionIds.find((optionId) => !existingOptionIds.has(optionId));
      if (invalidOption) {
        return jsonResponse(400, { error: "One or more options do not belong to this poll" });
      }
    }

    const { error: deleteError } = await supabase
      .from("plan_poll_votes")
      .delete()
      .eq("poll_id", pollId)
      .eq("user_id", user.id);

    if (deleteError) {
      return jsonResponse(400, { error: deleteError.message });
    }

    if (optionIds.length > 0) {
      const votes = optionIds.map((optionId) => ({
        poll_id: pollId,
        option_id: optionId,
        user_id: user.id,
      }));

      const { error: insertError } = await supabase.from("plan_poll_votes").insert(votes);
      if (insertError) {
        return jsonResponse(400, { error: insertError.message });
      }
    }

    return jsonResponse(200, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
});
