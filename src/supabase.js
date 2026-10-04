import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ehnbllptqqhdufucfyeb.supabase.co";
const SUPABASE_KEY = "sb_publishable_PjvTvA6oghhTC-uWP-aWuA_JSG5OGg9";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// Colonnes de profiles visibles par les autres membres (liste blanche de
// supabase/migrations/20261006000001_profils_prives.sql). Son propre profil
// complet se lit avec supabase.rpc("get_my_profile").
export const PUBLIC_PROFILE_COLUMNS = "id, full_name, username, city, bio, strategy, investing_since, streak_mois";
