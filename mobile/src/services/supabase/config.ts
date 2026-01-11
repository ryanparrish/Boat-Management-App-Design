// Supabase configuration
export const projectId = "hcnmxilmrzhhcqtqpdxc"
export const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjbm14aWxtcnpoaGNxdHFwZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NDY2MzIsImV4cCI6MjA4MTIyMjYzMn0.c7Jw74BPXHJR7nShfMmxXtmdMxTs9HRTF4hmAFkprxk"
export const supabaseUrl = `https://${projectId}.supabase.co`

// Change this to use the new table-based API once deployed
// Old KV-based API: `${supabaseUrl}/functions/v1/server/make-server-4ab53527`
// New table-based API: `${supabaseUrl}/functions/v1/server`
export const functionsUrl = `${supabaseUrl}/functions/v1/server`
