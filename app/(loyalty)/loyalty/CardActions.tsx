"use client";
import { useEffect, useState } from "react";
import { activationCopy } from "@/lib/loyalty/activation-copy";
import {
  customerCopy,
  type CustomerLanguage,
} from "@/lib/loyalty/customer-copy";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function CardActions({
  lang,
  qr,
}: {
  lang: CustomerLanguage;
  qr: string;
}) {
  const a = activationCopy[lang],
    t = customerCopy[lang];
  const [install, setInstall] = useState<InstallEvent | null>(null),
    [help, setHelp] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await document.fonts.ready;
      const node = document.getElementById("download-card");
      if (!node) throw new Error("Missing card");
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(node, {
        pixelRatio: 3,
        backgroundColor: "#0f1311",
      });
      if (!blob) throw new Error("Image failed");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Suro-${lang}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError(t.loadError);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card-recovery">
      <p>{a.warning}</p>
      <div className="loyalty-actions">
        <button
          className="loyalty-primary"
          disabled={!qr || busy}
          onClick={() => void save()}
        >
          {t.download}
        </button>
        <button
          onClick={async () => {
            if (install) {
              await install.prompt();
              setInstall(null);
            } else setHelp(!help);
          }}
        >
          {a.install}
        </button>
      </div>
      {help && (
        <p role="status">
          {/iPad|iPhone|iPod/.test(navigator.userAgent) ? a.ios : a.other}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
