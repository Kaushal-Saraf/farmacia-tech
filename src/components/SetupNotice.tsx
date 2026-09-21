export function SetupNotice() {
  return (
    <div className="rounded-2xl bg-brand-50 p-5 text-sm text-brand-900 ring-1 ring-brand-100">
      <p className="font-bold">Sign-in isn't connected yet</p>
      <p className="mt-2 text-brand-800">
        Add <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="rounded bg-white px-1">.env.local</code>, then restart the dev server. See the README.
      </p>
    </div>
  );
}
