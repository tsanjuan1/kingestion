import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="workspace-panel workspace-panel-strong max-w-[34rem] text-center">
        <p className="workspace-kicker">Not found</p>
        <h1 className="mt-3 text-4xl font-[var(--font-display)] tracking-[-0.06em] text-white">
          This workspace page does not exist.
        </h1>
        <p className="mx-auto mt-4 max-w-[28rem] text-sm leading-7 text-white/62">
          The Kingston case you requested may have been removed from the demo dataset or the route is not available yet.
        </p>
        <div className="mt-8 flex justify-center">
          <Link className="workspace-button" href="/dashboard">
            Return to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
