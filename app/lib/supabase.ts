import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xinoxcjltqhsjzmlhcfv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpbm94Y2psdHFoc2p6bWxoY2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NzA4NjUsImV4cCI6MjA5MzI0Njg2NX0.KHDPGCoQRMzY6SoJjKI2jExyi5TAOpwAQOEl-xWxowA";

export const supabase = createClient(supabaseUrl, supabaseKey);
