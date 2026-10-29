import { UploadBox } from "@/components/UploadBox";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-semibold">CAD Area Extractor</h1>
      <p className="mt-3 max-w-prose text-muted">
        Upload an AutoCAD drawing. You get every room with its length, breadth and area, grouped by floor.
      </p>
      <div className="mt-10">
        <UploadBox />
      </div>
    </main>
  );
}
