export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div lang="en">
      <header className="loyalty-header">
        <a href="/loyalty" aria-label="Suro loyalty">
          <span className="loyalty-mark" />
        </a>
        <nav aria-label="Main">
          <a href="/ka">Menu</a>
          <a href="/loyalty">Your card</a>
        </nav>
      </header>
      {children}
      <footer className="loyalty-footer">
        Suro · 12 Tsotne Dadiani St, Tbilisi
      </footer>
    </div>
  );
}
