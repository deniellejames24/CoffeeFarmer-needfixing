import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://wmzhpbtaulvpneqejrlj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtemhwYnRhdWx2cG5lcWVqcmxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNzIxNDAsImV4cCI6MjA1ODk0ODE0MH0.cYjFKGn6I9y83R8xeSE90thAhN5qGUe72eRGr-AuM-8"; 

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
