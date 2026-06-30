import { Hero } from "./_components/hero";
import { Below } from "./_components/below";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <Below />
    </main>
  );
}
