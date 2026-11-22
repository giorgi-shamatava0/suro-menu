import QRCode from "qrcode";
export async function GET(request: Request) {
  const origin = process.env.LOYALTY_APP_URL ?? new URL(request.url).origin;
  if (!origin)
    return new Response("Configure the public loyalty URL first", {
      status: 503,
    });
  return new Response(
    await QRCode.toString(`${origin}/loyalty`, {
      type: "svg",
      margin: 4,
      width: 512,
      errorCorrectionLevel: "M",
    }),
    {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": 'attachment; filename="suro-signup.svg"',
        "Cache-Control": "no-store",
      },
    },
  );
}
