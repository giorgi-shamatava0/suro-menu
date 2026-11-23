"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="loyalty-main">
      <h1>Let’s try that again.</h1>
      <p>
        We couldn’t load loyalty. Please retry or ask the café team for help.
      </p>
      <button className="loyalty-button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
