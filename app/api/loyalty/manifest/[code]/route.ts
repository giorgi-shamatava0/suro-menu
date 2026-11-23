export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!/^(?:[a-f0-9]{64}|[A-Za-z0-9_-]{22})$/.test(code))
    return new Response(null, { status: 404 });
  return Response.json(
    {
      id: `/c/${code}`,
      name: "Suro Loyalty Card",
      short_name: "Suro Loyalty Card",
      start_url: `/c/${code}`,
      scope: "/",
      display: "standalone",
      background_color: "#0f1311",
      theme_color: "#244c3b",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icon.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
