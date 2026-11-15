import { Button } from "@/components/ui/button";
import { publicEnv } from "@/lib/env";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        ModaFlow — Frontend funcionando
      </h1>
      <Button asChild variant="outline">
        <a href={`${publicEnv.apiUrl}/health`} target="_blank" rel="noreferrer">
          Comprobar API (/health)
        </a>
      </Button>
    </main>
  );
}
