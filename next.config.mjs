/** @type {import('next').NextConfig} */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://mhklbqlsdwudysfpklzx.supabase.co'
// Supabase provides the publishable key as a server environment variable in
// Vercel. Explicitly expose only that public key to the browser bundle.
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''

const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mhklbqlsdwudysfpklzx.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
  },
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublicKey,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabasePublicKey,
    // Make the Vercel-provided server variable available to client modules.
    SUPABASE_PUBLISHABLE_KEY: supabasePublicKey,
    SUPABASE_ANON_KEY: supabasePublicKey,
  },
}

export default nextConfig
