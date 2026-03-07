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
    return jsonResponse(200, { success: false, error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(200, { success: false, error: "Missing Authorization header" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(200, { success: false, error: "Supabase environment is not configured" });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const payload = await req.json().catch(() => null);
    const pollId = payload?.pollId;
    const questionRaw = payload?.question;
    const optionsRaw = payload?.options;

    if (typeof pollId !== "string" || !pollId) {
      return jsonResponse(200, { success: false, error: "pollId is required" });
    }
    if (typeof questionRaw !== "string" || !questionRaw.trim()) {
      return jsonResponse(200, { success: false, error: "question is required" });
    }
    if (!Array.isArray(optionsRaw) || optionsRaw.length < 2) {
      return jsonResponse(200, { success: false, error: "options must contain at least 2 items" });
    }

    const options = optionsRaw
      .map((value: unknown) => (typeof value === "string" ? value.trim() : ""))
      .filter((value: string) => value.length > 0);

    if (options.length < 2) {
      return jsonResponse(200, { success: false, error: "options must contain at least 2 non-empty values" });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse(200, { success: false, error: "Unauthorized" });
    }

    const { data: poll, error: pollError } = await supabase
      .from("plan_polls")
      .select("id, plan_id")
      .eq("id", pollId)
      .single();
    if (pollError || !poll) {
      return jsonResponse(200, { success: false, error: "Poll not found" });
    }

    const { data: participant, error: participantError } = await supabase
      .from("plan_participants")
      .select("user_id")
      .eq("plan_id", poll.plan_id)
      .eq("user_id", user.id)
      .single();
    if (participantError || !participant) {
      return jsonResponse(200, { success: false, error: "Only plan participants can edit polls" });
    }

    const { data: currentOptions, error: currentOptionsError } = await supabase
      .from("plan_poll_options")
      .select("id, option_text, option_order")
      .eq("poll_id", pollId)
      .order("option_order", { ascending: true });

    if (currentOptionsError) {
      return jsonResponse(200, { success: false, error: currentOptionsError.message });
    }

    if (!currentOptions || currentOptions.length === 0) {
      return jsonResponse(200, { success: false, error: "Poll has no options to edit" });
    }

    const { data: votes, error: votesError } = await supabase
      .from("plan_poll_votes")
      .select("option_id")
      .eq("poll_id", pollId);
    if (votesError) {
      return jsonResponse(200, { success: false, error: votesError.message });
    }

    const voteCounts = new Map<string, number>();
    for (const vote of votes ?? []) {
      const optionId = vote.option_id as string;
      voteCounts.set(optionId, (voteCounts.get(optionId) ?? 0) + 1);
    }

    const rankedOptions = [...currentOptions]
      .map((option) => ({
        ...option,
        votes: voteCounts.get(option.id) ?? 0,
      }))
      .sort((a, b) => b.votes - a.votes);

    const protectedOptionIds = new Set(
      rankedOptions
        .filter((option) => option.votes > 0)
        .slice(0, 2)
        .map((option) => option.id),
    );

    const protectedOptionTexts: string[] = [];
    const protectedByIndex = new Set<number>();
    currentOptions.forEach((option, index) => {
      if (protectedOptionIds.has(option.id)) {
        protectedByIndex.add(index);
        protectedOptionTexts.push(option.option_text);
      }
    });

    // If removing options, ensure none of the removed ones have votes
    if (options.length < currentOptions.length) {
      for (let i = options.length; i < currentOptions.length; i += 1) {
        const votesOnOption = voteCounts.get(currentOptions[i].id) ?? 0;
        if (votesOnOption > 0) {
          return jsonResponse(200, {
            success: false,
            error: "Cannot remove options that have votes",
          });
        }
      }
    }

    // Protected check: top-voted option texts cannot be changed
    const minLen = Math.min(currentOptions.length, options.length);
    for (let index = 0; index < minLen; index += 1) {
      if (!protectedByIndex.has(index)) continue;
      const previousText = currentOptions[index].option_text.trim();
      const nextText = options[index].trim();
      if (previousText !== nextText) {
        return jsonResponse(200, {
          success: false,
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
      return jsonResponse(200, { success: false, error: updatePollError.message });
    }

    // Update existing options (by index)
    for (let index = 0; index < minLen; index += 1) {
      if (protectedByIndex.has(index)) continue;
      const optionId = currentOptions[index].id;
      const newText = options[index];
      const { error: optionUpdateError } = await supabase
        .from("plan_poll_options")
        .update({ option_text: newText })
        .eq("id", optionId);
      if (optionUpdateError) {
        return jsonResponse(200, { success: false, error: optionUpdateError.message });
      }
    }

    // Add new options when user sent more than current
    if (options.length > currentOptions.length) {
      const inserts = [];
      for (let index = currentOptions.length; index < options.length; index += 1) {
        inserts.push({
          poll_id: pollId,
          option_text: options[index],
          option_order: index,
        });
      }
      const { error: insertError } = await supabase.from("plan_poll_options").insert(inserts);
      if (insertError) {
        return jsonResponse(200, { success: false, error: insertError.message });
      }
    }

    // Remove options when user sent fewer (only those with 0 votes were allowed above)
    if (options.length < currentOptions.length) {
      const idsToDelete = currentOptions
        .slice(options.length)
        .map((o) => o.id);
      const { error: deleteError } = await supabase
        .from("plan_poll_options")
        .delete()
        .in("id", idsToDelete);
      if (deleteError) {
        return jsonResponse(200, { success: false, error: deleteError.message });
      }
    }

    return jsonResponse(200, {
      success: true,
      protectedOptions: protectedOptionTexts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse(200, { success: false, error: message });
  }
});
