"use client";
import { useEffect, useRef, useState } from "react";
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
  cardCode,
  ready = true,
}: {
  lang: CustomerLanguage;
  qr: string;
  cardCode: string;
  ready?: boolean;
}) {
  const a = activationCopy[lang],
    t = customerCopy[lang];
  const dialog = useRef<HTMLDialogElement>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [ios, setIos] = useState(false);
  const storageKey = `suro-card-help:${cardCode}`;
  useEffect(() => {
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const installed = () => {
      setInstall(null);
      setHelp(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  useEffect(() => {
    if (!ready || !qr) return;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {}
    dialog.current?.showModal();
  }, [ready, qr, storageKey]);
  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    dialog.current?.close();
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const image = new Image();
      image.src = qr;
      const logo = new Image();
      logo.src = "/logo-mask.png";
      await Promise.all([
        image.decode(),
        logo.decode(),
        document.fonts.load('600 52px "Suro Georgian Script"'),
      ]);
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1380;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.fillStyle = "#064c3b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const logoCanvas = document.createElement("canvas");
      logoCanvas.width = 240;
      logoCanvas.height = 166;
      const logoCtx = logoCanvas.getContext("2d");
      if (!logoCtx) throw new Error("Canvas unavailable");
      const logoScale = Math.min(240 / logo.width, 166 / logo.height);
      const logoWidth = logo.width * logoScale;
      const logoHeight = logo.height * logoScale;
      logoCtx.drawImage(
        logo,
        (240 - logoWidth) / 2,
        (166 - logoHeight) / 2,
        logoWidth,
        logoHeight,
      );
      logoCtx.globalCompositeOperation = "source-in";
      logoCtx.fillStyle = "#f5efda";
      logoCtx.fillRect(0, 0, 240, 166);
      ctx.drawImage(logoCanvas, 420, 55);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f5efda";
      ctx.font = '600 52px "Suro Georgian Script", sans-serif';
      ctx.fillText("ლოიალურობის ბარათი", 540, 282, 860);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 110, 390, 860, 860);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Image failed"))),
          "image/png",
        ),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Suro-Loyalty-Card.png";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setSaved(true);
    } catch {
      setError(t.loadError);
    } finally {
      setBusy(false);
    }
  }
  async function addToHome() {
    setError("");
    if (!install) {
      setHelp(true);
      return;
    }
    try {
      await install.prompt();
      await install.userChoice;
      setInstall(null);
    } catch {
      setInstall(null);
      setHelp(true);
    }
  }
  return (
    <section className="card-recovery">
      <button
        className="card-recovery-info"
        aria-label={a.recoveryInfo}
        onClick={() => dialog.current?.showModal()}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6m0-10v1" />
        </svg>
        {a.recoveryInfo}
      </button>
      <dialog
        ref={dialog}
        className="card-recovery-dialog"
        aria-labelledby="card-recovery-title"
        aria-describedby="card-recovery-description"
        onCancel={(e) => {
          e.preventDefault();
          dismiss();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dismiss();
        }}
      >
        <div className="card-recovery-content">
          <button
            className="card-recovery-close"
            aria-label={a.dismiss}
            onClick={dismiss}
            autoFocus
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
          <h2 id="card-recovery-title">{a.recoveryTitle}</h2>
          <p id="card-recovery-description">{a.recoveryBody}</p>
          <div className="card-recovery-actions">
            <button
              className="loyalty-primary"
              disabled={!qr || busy}
              onClick={() => void save()}
            >
              {busy ? "…" : saved ? a.saved : a.saveQr}
            </button>
            <button onClick={() => void addToHome()}>{a.install}</button>
          </div>
          {help && (
            <p className="card-recovery-help" role="status">
              {ios ? a.ios : a.other}
            </p>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      </dialog>
    </section>
  );
}
