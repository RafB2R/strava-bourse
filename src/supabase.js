import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ehnbllptqqhdufucfyeb.supabase.co";
const SUPABASE_KEY = "sb_publishable_PjvTvA6oghhTC-uWP-aWuA_JSG5OGg9";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);