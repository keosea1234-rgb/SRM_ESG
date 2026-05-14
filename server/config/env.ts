// Loads and validates required server environment variables from process.env.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Required Supabase project URL for backend data access.
export const SUPABASE_URL: string = requireEnv("SUPABASE_URL");

// Required Supabase service role key for privileged backend operations.
export const SUPABASE_SERVICE_ROLE_KEY: string = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

// Required JWT secret for verifying Supabase-issued tokens.
export const SUPABASE_JWT_SECRET: string = requireEnv("SUPABASE_JWT_SECRET");

// Required public application URL used for redirects and links.
export const APP_URL: string = requireEnv("APP_URL");

// Required API port number the backend listens on.
export const PORT: number = Number(requireEnv("PORT"));

if (Number.isNaN(PORT)) {
  throw new Error("Environment variable PORT must be a valid number");
}