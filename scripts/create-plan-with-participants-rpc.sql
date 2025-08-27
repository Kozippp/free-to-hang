-- Create RPC function for creating plans with participants in a single transaction
CREATE OR REPLACE FUNCTION create_plan_with_participants(
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_date TIMESTAMP WITH TIME ZONE,
  p_invited_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_is_anonymous BOOLEAN DEFAULT FALSE,
  p_max_participants INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  creator_id UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  date TIMESTAMP WITH TIME ZONE,
  is_anonymous BOOLEAN,
  max_participants INTEGER,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan_id UUID;
  v_creator_id UUID := auth.uid();
  v_plan_record RECORD;
BEGIN
  -- Validate required parameters
  IF p_title IS NULL OR p_title = '' THEN
    RAISE EXCEPTION 'Plan title is required';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Plan date is required';
  END IF;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Start transaction (implicit in function)
  BEGIN
    -- Create the plan
    INSERT INTO public.plans (
      creator_id,
      title,
      description,
      location,
      date,
      is_anonymous,
      max_participants,
      status
    ) VALUES (
      v_creator_id,
      p_title,
      p_description,
      p_location,
      p_date,
      p_is_anonymous,
      p_max_participants,
      'active'
    )
    RETURNING * INTO v_plan_record;

    v_plan_id := v_plan_record.id;

    -- Add creator as participant
    INSERT INTO public.plan_participants (
      plan_id,
      user_id,
      status
    ) VALUES (
      v_plan_id,
      v_creator_id,
      CASE WHEN p_is_anonymous THEN 'pending' ELSE 'accepted' END
    );

    -- Add invited users as participants (if any)
    IF array_length(p_invited_user_ids, 1) > 0 THEN
      INSERT INTO public.plan_participants (
        plan_id,
        user_id,
        status
      )
      SELECT
        v_plan_id,
        unnest(p_invited_user_ids),
        'pending'::TEXT;
    END IF;

    -- Return the created plan
    RETURN QUERY
    SELECT
      v_plan_record.id,
      v_plan_record.creator_id,
      v_plan_record.title,
      v_plan_record.description,
      v_plan_record.location,
      v_plan_record.date,
      v_plan_record.is_anonymous,
      v_plan_record.max_participants,
      v_plan_record.status,
      v_plan_record.created_at,
      v_plan_record.updated_at;

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback will happen automatically on exception
      RAISE;
  END;
END;
$$;
