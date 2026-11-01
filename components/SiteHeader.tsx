import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="bar">
        <Link href="/" className="brand">
          Jashn
        </Link>
        <nav aria-label="Main">
          <ul className="nav">
            <li>
              <Link href="/start">Start planning</Link>
            </li>
            <li>
              <Link href="/plan">My plan</Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
