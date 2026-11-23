export const LANGS = ["ka", "en", "ru"] as const;
export type Lang = (typeof LANGS)[number];
export type Tr = { ka?: string; en?: string; ru?: string } | undefined;

// The requested language first, then ka → en → ru; "" when nothing is filled in.
export const pick = (t: Tr, lang: Lang) => (t && (t[lang] || t.ka || t.en || t.ru)) || "";

const ui = {
  name: ["სურო", "Suro", "Суро"],
  menu: ["მენიუ", "Menu", "Меню"],
  categories: ["კატეგორიები", "Categories", "Категории"],
  search: ["კერძის ან სასმელის ძებნა", "Search dishes and drinks", "Поиск блюд и напитков"],
  nothing: ["ვერაფერი მოიძებნა", "Nothing found", "Ничего не найдено"],
  close: ["დახურვა", "Close", "Закрыть"],
  top: ["ზემოთ", "Back to top", "Наверх"],
  soldOut: ["ამოიწურა", "Sold out", "Закончилось"],
  legal: ["პირობები · კონფიდენციალურობა", "Terms · Privacy", "Условия · Конфиденциальность"],
  loyalty: ["ჩემი ბარათი", "My card", "Моя карта"],
  visit: ["გვესტუმრეთ", "Visit us", "Ждём вас"],
  clear: ["გასუფთავება", "Clear", "Сбросить"],
  filters: ["ფილტრი", "Filter", "Фильтр"],
  "tag.signature": ["საფირმო", "Signature", "Фирменное"],
  "tag.new": ["ახალი", "New", "Новинка"],
  "tag.vegan": ["ვეგანური", "Vegan", "Веганское"],
  "tag.vegetarian": ["ვეგეტარიანული", "Vegetarian", "Вегетарианское"],
  "tag.spicy": ["ცხარე", "Spicy", "Острое"],
  "tag.gluten-free": ["უგლუტენო", "Gluten-free", "Без глютена"],
} as const;

export type UiKey = keyof typeof ui;
export const dict = (lang: Lang) => {
  const i = LANGS.indexOf(lang);
  return Object.fromEntries(Object.entries(ui).map(([k, v]) => [k, v[i]])) as Record<UiKey, string>;
};
