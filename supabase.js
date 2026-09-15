// supabase.js

const SUPABASE_URL = 'https://tznbtkiocucmofhceacm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bmJ0a2lvY3VjbW9maGNlYWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0Mzc4NTksImV4cCI6MjEwNTAxMzg1OX0.xAlDp6timZCYrFhK6MOGuGwYDeDvrHryJYSrjOW-ncE';

// Initialize the Supabase client (Renamed to supabaseClient to avoid conflict)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);