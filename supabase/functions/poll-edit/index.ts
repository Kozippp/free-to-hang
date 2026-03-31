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
    const questionRaw = payload?.question;
    const optionsRaw = payload?.options;

    if (typeof pollId !== "string" || !pollId) {
      return jsonResponse(400, { error: "pollId is required" });
    }
    if (typeof questionRaw !== "string" || !questionRaw.trim()) {
      return jsonResponse(400, { error: "question is required" });
    }
    if (!Array.isArray(optionsRaw) || optionsRaw.length < 2) {
      return jsonResponse(400, { error: "options must contain at least 2 items" });
    }

    const options = optionsRaw
      .map((value: unknown) => (typeof value === "string" ? value.trim() : ""))
      .filter((value: string) => value.length > 0);

    if (options.length < 2) {
      return jsonResponse(400, { error: "options must contain at least 2 non-empty values" });
    }

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
      .select("user_id")
      .eq("plan_id", poll.plan_id)
      .eq("user_id", user.id)
      .single();
    if (participantError || !participant) {
      return jsonResponse(403, { error: "Only plan participants can edit polls" });
    }

    const { data: currentOptions, error: currentOptionsError } = await supabase
      .from("plan_poll_options")
      .select("id, option_text, option_order")
      .eq("poll_id", pollId)
      .order("option_order", { ascending: true });

    if (currentOptionsError) {
      return jsonResponse(400, { error: currentOptionsError.message });
    }

    if (!currentOptions || currentOptions.length === 0) {
      return jsonResponse(400, { error: "Poll has no options to edit" });
    }

    if (options.length !== currentOptions.length) {
      return jsonResponse(400, {
        error: "Changing option count is not allowed in this editor",
      });
    }

    const { data: votes, error: votesError } = await supabase
      .from("plan_poll_votes")
      .select("option_id")
      .eq("poll_id", pollId);
    if (votesError) {
      return jsonResponse(400, { error: votesError.message });
    }

    const voteCounts = new Map<string, number>();
    for (const vote of votes ?? []) {
      const optionId = vote.option_id as string;
      voteCounts.set(optionId, (voteCounts.get(optionId) ?? 0) + 1);
    }

    const withVotes = currentOptions.map((option) => ({
      ...option,
      votes: voteCounts.get(option.id) ?? 0,
    }));

    const counts = withVotes.map((o) => o.votes);
    const minVotes = Math.min(...counts);
    const maxVotes = Math.max(...counts);
    const allSameCount = minVotes === maxVotes;

    const protectedOptionIds = new Set<string>();
    if (!allSameCount && currentOptions.length >= 2) {
      const ranked = [...withVotes].sort(
        (a, b) => b.votes - a.votes || a.option_order - b.option_order,
      );
      protectedOptionIds.add(ranked[0].id);
      protectedOptionIds.add(ranked[1].id);
    }

    const protectedOptionTexts: string[] = [];
    const protectedByIndex = new Set<number>();
    currentOptions.forEach((option, index) => {
      if (protectedOptionIds.has(option.id)) {
        protectedByIndex.add(index);
        protectedOptionTexts.push(option.option_text);
      }
    });

    for (let index = 0; index < currentOptions.length; index += 1) {
      if (!protectedByIndex.has(index)) {
        continue;
      }

      const previousText = currentOptions[index].option_text.trim();
      const nextText = options[index].trim();
      if (previousText !== nextText) {
        return jsonResponse(400, {
          error: "Cannot edit top voted options",
          protectedOptions: protectedOptionTexts,
        });
      }
    }

    const { error: updatePollError } = await supabase
      .from("plan_polls")
      .update({ title: questionRaw.trim() })
      .eq("id", pollId);
    if (updatePollError) {
      return jsonResponse(400, { error: updatePollError.message });
    }

    for (let index = 0; index < currentOptions.length; index += 1) {
      if (protectedByIndex.has(index)) {
        continue;
      }

      const optionId = currentOptions[index].id;
      const newText = options[index];
      const { error: optionUpdateError } = await supabase
        .from("plan_poll_options")
        .update({ option_text: newText })
        .eq("id", optionId);

      if (optionUpdateError) {
        return jsonResponse(400, { error: optionUpdateError.message });
      }
    }

    return jsonResponse(200, {
      success: true,
      protectedOptions: protectedOptionTexts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(500, { error: message });
  }
});
