import { Suspense } from "react";
import { ResultsView } from "@/components/ResultsView";

// The id is only known at request time, so reading it must sit inside <Suspense>.
async function Results({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultsView id={id} />;
}

export default function DrawingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-10 text-muted">Loading drawing…</p>}>
      <Results params={params} />
    </Suspense>
  );
}
