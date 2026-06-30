import { Hero } from "./_components/hero";
import { Showcase } from "./_components/showcase";
import { Below } from "./_components/below";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      <Showcase />
      <Below />
    </main>
  );
}
