import Link from "next/link";
import { SampleButtons } from "@/components/SampleButtons";
import { SiteHeader } from "@/components/SiteHeader";

const pillars = [
  {
    title: "It asks before it plans",
    body: "Occasion, date, guests, budget and what matters most to you come first. Then the plan, the budget and the ideas are built around your answers, not a generic top-ten list.",
  },
  {
    title: "A plan that bends",
    body: "Budget cut, date moved up, guest list grown? Jashn re-plans from where you are: finished tasks stay finished, and you see exactly what moved and what to give up.",
  },
  {
    title: "Honest numbers",
    body: "Budget lines are planning estimates and say so. Vendor prices appear only when you enter a quote, and are always marked unverified until you book.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="container stack">
        <section className="hero stack" aria-labelledby="hero-title">
          <h1 id="hero-title">Plan the celebration, not just the ideas.</h1>
          <p>
            Jashn turns a wedding, birthday or community event into a budget, a timeline with real dependencies, a vendor checklist and
            ideas that fit your family. It keeps the plan alive as things change.
          </p>
          <div className="row">
            <Link href="/start" className="btn">
              Plan my event
            </Link>
          </div>
          <SampleButtons />
        </section>

        <section aria-labelledby="how-title" className="stack">
          <h2 id="how-title">How it helps</h2>
          <div className="grid grid-3">
            {pillars.map((pillar) => (
              <article className="card" key={pillar.title}>
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="private-title">
          <h2 id="private-title">Private by design</h2>
          <p>
            Your plan stays in your browser. Only the text you send for an AI suggestion (like a vendor message you paste) leaves it, and
            nothing is stored on our servers. Jashn gives planning help, not guarantees: always confirm prices and availability with vendors.
          </p>
        </section>
      </main>
      <p className="footer">Jashn: a GenAI celebration planner.</p>
    </>
  );
}
