import Image from "next/image";
import { hero, plates } from "@/lib/decor";
export default function CustomerFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="customer-page">
      <div className="customer-scenery" aria-hidden="true">
        <Image
          className="customer-canopy"
          src={hero.canopy}
          alt=""
          sizes="(max-width: 600px) 150vw, 100vw"
        />
        <Image
          className="customer-basket"
          src={hero.basket}
          alt=""
          sizes="(max-width: 600px) 190px, 300px"
        />
        <Image
          className="customer-bulbs"
          src={hero.bulbs}
          alt=""
          sizes="(max-width: 600px) 120px, 180px"
        />
        <Image
          className="customer-leaf-left"
          src={plates["fern-frond"]}
          alt=""
          sizes="(max-width: 600px) 280px, 420px"
        />
        <Image
          className="customer-leaf-right"
          src={plates["monstera-b"]}
          alt=""
          sizes="(max-width: 600px) 280px, 400px"
        />
      </div>
      {children}
    </div>
  );
}
