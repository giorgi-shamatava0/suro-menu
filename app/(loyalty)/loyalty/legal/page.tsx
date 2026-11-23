import {backend} from "@/lib/loyalty/server";
import {api} from "@/convex/_generated/api";
import { Suspense } from "react";
import { customerLanguage } from "@/lib/loyalty/customer-copy";
import { activationCopy } from "@/lib/loyalty/activation-copy";
const notice = {
  en: [
    "Activating a loyalty card is optional. We do not ask for your name, email or phone number.",
    "Activation stores a card secret in an essential browser cookie and a recovery identifier in local storage for up to five years (local storage remains until removed). The server stores card identifiers, activation time and consent version, stamps, rewards, expiry dates and staff transaction records. A hashed network address is used to limit card creation; raw IP addresses are not stored in the loyalty database. Hosting providers may process technical request logs.",
    "The QR opens a read-only live card. Anyone who has it can see its stamps and rewards. Save the QR before clearing browser data. Staff authorization is required to change stamps.",
    "Rewards and expiry follow the program rules shown on your card. Downloaded images are snapshots. Staff confirm redemption against the live card. Contact Suro in person about your card, data access or deletion.",
    "The menu remembers language and uses browser session storage for the intro animation. These preferences do not create a loyalty membership. No advertising or analytics tracking is added by loyalty activation.",
  ],
  ka: [
    "ლოიალობის ბარათის აქტივაცია ნებაყოფლობითია. სახელს, ელფოსტას ან ტელეფონის ნომერს არ ვითხოვთ.",
    "აქტივაციისას ბარათის საიდუმლო ინახება ბრაუზერის აუცილებელ ქუქიში ხუთ წლამდე, ხოლო აღდგენის იდენტიფიკატორი — ლოკალურ საცავში წაშლამდე. სერვერზე ინახება ბარათის იდენტიფიკატორები, აქტივაციის დრო და თანხმობის ვერსია, შტამპები, საჩუქრები, ვადები და თანამშრომელთა ოპერაციები. ბარათების შექმნის შესაზღუდად გამოიყენება ქსელის მისამართის ჰეში; IP მისამართი ლოიალობის ბაზაში ღიად არ ინახება. ჰოსტინგის მომწოდებლებმა შეიძლება დაამუშაონ ტექნიკური მოთხოვნების ჟურნალები.",
    "QR კოდი ხსნის ბარათს მხოლოდ სანახავად. კოდის მქონე პირს შეუძლია შტამპებისა და საჩუქრების ნახვა. ბრაუზერის მონაცემების წაშლამდე შეინახე QR. შტამპების შეცვლა თანამშრომლის ავტორიზაციას მოითხოვს.",
    "საჩუქრები და ვადები ბარათზე ნაჩვენები პროგრამის წესებს ექვემდებარება. ჩამოტვირთული სურათი ასახავს ჩამოტვირთვის მომენტს. თანამშრომელი საჩუქრის გაცემას ცოცხალი ბარათით ამოწმებს. ბარათის, მონაცემებზე წვდომის ან წაშლის საკითხზე მიმართე სუროს ადგილზე.",
    "მენიუ იმახსოვრებს ენას და შესავალი ანიმაციისთვის იყენებს ბრაუზერის სესიის საცავს. ეს პარამეტრები ლოიალობის წევრობას არ ქმნის. აქტივაცია სარეკლამო ან ანალიტიკურ თვალთვალს არ ამატებს.",
  ],
  ru: [
    "Активация карты добровольна. Мы не запрашиваем имя, email или телефон.",
    "При активации секрет карты сохраняется в необходимом cookie на срок до пяти лет, а идентификатор восстановления — в локальном хранилище до удаления. Сервер хранит идентификаторы карты, дату активации и версию согласия, штампы, подарки, сроки и операции сотрудников. Для ограничения создания карт используется хеш сетевого адреса; открытый IP не хранится в базе программы. Хостинг может обрабатывать технические журналы запросов.",
    "QR открывает живую карту только для просмотра. Любой человек с QR может увидеть штампы и подарки. Сохраните QR до очистки браузера. Изменять штампы могут только авторизованные сотрудники.",
    "Подарки и сроки определяются правилами программы на карте. Скачанное изображение — снимок состояния. Сотрудник проверяет выдачу подарка по живой карте. По вопросам карты, доступа к данным или удаления обратитесь в Suro лично.",
    "Меню запоминает язык и использует хранилище сессии для вступительной анимации. Эти настройки не создают участие в программе. Активация не добавляет рекламное или аналитическое отслеживание.",
  ],
};
async function Content({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = customerLanguage((await searchParams).lang),
    a = activationCopy[lang];
  const custom=await backend().query(api.loyalty.publicTerms,{}).catch(()=>null);
  return (
    <main className="loyalty-main" lang={lang}>
      <h1>
        {a.terms} · {a.privacy}
      </h1>
      {notice[lang].map((p) => (
        <p
          key={p}
          style={{ lineHeight: 1.8, maxWidth: "65ch", marginBlock: 24 }}
        >
          {p}
        </p>
      ))}
      {custom?.[lang]&&<section><h2>{a.terms}</h2><p style={{whiteSpace:"pre-wrap",lineHeight:1.8}}>{custom[lang]}</p></section>}
      <a href="/loyalty">Suro</a>
    </main>
  );
}
export default function Page(props: {
  searchParams: Promise<{ lang?: string }>;
}) {
  return (
    <Suspense>
      <Content {...props} />
    </Suspense>
  );
}
