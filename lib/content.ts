/**
 * Static help & legal content (spec 4.14) in both languages. Long texts live here as
 * { ar, en } pairs instead of the UI dictionary so each page reads as one document.
 */
import { getLang } from "@/lib/i18n";

export type Bi = { ar: string; en: string };
export type Section = { title: Bi; body: Bi };
export type StaticPage = { title: Bi; updated?: Bi; intro?: Bi; sections: Section[] };

export const SUPPORT_EMAIL = "support@daralsila.om";

export const pick = (value: Bi) => (getLang() === "en" ? value.en : value.ar);

export const PAGES: Record<string, StaticPage> = {
  terms: {
    title: { ar: "شروط الاستخدام", en: "Terms & Conditions" },
    updated: { ar: "آخر تحديث: 3 نوفمبر 2026", en: "Last updated: 3 November 2026" },
    sections: [
      { title: { ar: "استخدام دار السلع", en: "Using Dar Al Sila" }, body: { ar: "دار السلع منصة وسيطة تربط المشترين بالبائعين والمحلات والتجار والموردين ومقدمي الخدمات في سلطنة عُمان. لا تملك المنصة السلع المعروضة ولا تحتفظ بأموال المشترين أو البائعين. يتحمل المعلن مسؤولية صحة وصف السلعة وسعرها وحقه في عرضها.", en: "Dar Al Sila is an intermediary marketplace connecting buyers with individual sellers, shops, merchants, suppliers and service providers in the Sultanate of Oman. The platform does not own the items listed and does not hold buyer or seller funds. Advertisers are responsible for the accuracy of their descriptions, prices and their right to sell." } },
      { title: { ar: "الإعلانات والمحتوى", en: "Listings and content" }, body: { ar: "يُمنع نشر المحتوى غير القانوني أو المضلل أو المنتهك لحقوق الآخرين أو أي منتج في قائمة المواد الممنوعة. تُفحص الإعلانات آليًا، وقد يراجعها المشرفون، ويحق للإدارة رفض أو إيقاف أي إعلان مخالف مع ذكر السبب.", en: "Illegal, misleading or infringing content, and any item on the prohibited items list, may not be posted. Listings are checked automatically and may be reviewed by moderators. The administration may reject or suspend any non-compliant listing and will state the reason." } },
      { title: { ar: "المتاجر", en: "Stores" }, body: { ar: "يمكن لأي مستخدم إنشاء متجر، ويظهر المتجر للعامة بعد موافقة الإدارة. صاحب المتجر مسؤول عن بيانات متجره ومنتجاته وتوفرها.", en: "Any user can create a store; it becomes public after the administration approves it. Store owners are responsible for their store details, products and availability." } },
      { title: { ar: "التواصل والسلامة", en: "Communication and safety" }, body: { ar: "يتم البيع والشراء مباشرة بين المستخدمين. افحص السلعة وتحقق من البائع قبل الدفع، ولا تشارك كلمات المرور أو رموز التحقق. يحق للمستخدم حظر أي مستخدم آخر أو الإبلاغ عنه.", en: "Buying and selling happen directly between users. Inspect items and verify the seller before paying, and never share passwords or verification codes. You may block or report any other user." } },
      { title: { ar: "الحساب", en: "Your account" }, body: { ar: "يمكنك تعديل بياناتك أو تسجيل الخروج أو طلب حذف حسابك من صفحة حسابي. عند الحذف تُزال إعلاناتك وصورك ومفضلتك وتُمسح بيانات ملفك.", en: "You can edit your details, sign out or request account deletion from the Account page. Deletion removes your listings, images and favorites and clears your profile." } },
    ],
  },
  "privacy-policy": {
    title: { ar: "سياسة الخصوصية", en: "Privacy Policy" },
    updated: { ar: "آخر تحديث: 6 نوفمبر 2026", en: "Last updated: 6 November 2026" },
    sections: [
      { title: { ar: "ما نجمعه", en: "What we collect" }, body: { ar: "نجمع الحد الأدنى اللازم لتشغيل حسابك: الاسم والبريد الإلكتروني ورقم الهاتف إن أضفته، وإعلاناتك وصورها ورسائلك ومفضلتك.", en: "We collect the minimum needed to run your account: your name, email, phone number if you add one, and your listings, images, messages and favorites." } },
      { title: { ar: "كيف نستخدمها", en: "How we use it" }, body: { ar: "تُعرض بيانات الإعلان للعامة وفق حالته. يظهر رقم هاتفك في إعلاناتك فقط إذا أضفته فيها. الرسائل لا يراها إلا طرفا المحادثة.", en: "Listing details are shown publicly according to the listing status. Your phone number appears on a listing only if you add it there. Messages are visible only to the two people in the conversation." } },
      { title: { ar: "الفحص الآلي للإعلانات", en: "Automated listing checks" }, body: { ar: "لحماية المشترين والبائعين، يُفحص نص كل إعلان منشور آليًا بحثًا عن المواد الممنوعة والاحتيال. وعند تفعيل الفحص بالذكاء الاصطناعي، يُرسَل نص الإعلان وصوره (دون اسمك أو بريدك أو رقمك) إلى مزوّد ذكاء اصطناعي (Anthropic) لتقييمه. لا يرفض الفحص الآلي إعلانًا نهائيًا بنفسه؛ القرار لفريق دار السلع، ويمكنك الاعتراض عليه.", en: "To protect buyers and sellers, the text of every published listing is checked automatically for prohibited items and scams. When AI review is enabled, the listing's text and photos (not your name, email or phone) are sent to an AI provider (Anthropic) for assessment. Automated checks never make a final rejection on their own; the Dar Al Sila team decides, and you can appeal." } },
      { title: { ar: "حقوقك", en: "Your rights" }, body: { ar: "يمكنك تعديل بياناتك أو حذف إعلاناتك أو طلب حذف حسابك في أي وقت من صفحة حسابي، أو بمراسلة الدعم.", en: "You can edit your data, delete your listings or request account deletion at any time from the Account page, or by contacting support." } },
    ],
  },
  safety: {
    title: { ar: "نصائح الأمان", en: "Safety tips" },
    intro: { ar: "دار السلع لا تطلب منك أبدًا رمز التحقق أو بيانات البطاقة عبر الرسائل.", en: "Dar Al Sila will never ask for your verification code or card details in a message." },
    sections: [
      { title: { ar: "لا تدفع قبل التحقق", en: "Don't pay before you check" }, body: { ar: "قابل البائع في مكان عام وآمن وافحص السلعة قبل تحويل أي مبلغ.", en: "Meet the seller in a safe public place and inspect the item before transferring any money." } },
      { title: { ar: "احمِ بياناتك", en: "Protect your data" }, body: { ar: "لا تشارك رمز التحقق أو بيانات البطاقة أو كلمات المرور مع أي شخص.", en: "Never share verification codes, card details or passwords with anyone." } },
      { title: { ar: "انتبه للعروض غير الواقعية", en: "Watch for unrealistic offers" }, body: { ar: "السعر المنخفض جدًا أو طلب الدفع المسبق أو التواصل خارج المنصة قد يكون مؤشرًا على الاحتيال.", en: "A price that is far too low, a request for advance payment or moving the chat off the platform can be signs of fraud." } },
      { title: { ar: "احتفظ بالأدلة وأبلغ", en: "Keep evidence and report" }, body: { ar: "احتفظ بالمحادثة والصور، واستخدم زر الإبلاغ في الإعلان أو المحادثة. يمكنك أيضًا حظر المستخدم.", en: "Keep the conversation and photos, and use the report button on the listing or the chat. You can also block the user." } },
    ],
  },
  "seller-guidelines": {
    title: { ar: "دليل البائع", en: "Seller guidelines" },
    sections: [
      { title: { ar: "اكتب إعلانًا واضحًا", en: "Write a clear listing" }, body: { ar: "اختر القسم الصحيح، واكتب عنوانًا محددًا، وأضف الحقول الخاصة بالقسم مثل الموديل والسنة أو المساحة.", en: "Pick the right category, write a specific title and fill in the category details such as model and year, or area." } },
      { title: { ar: "صور حقيقية", en: "Real photos" }, body: { ar: "استخدم صورًا حقيقية للسلعة نفسها، والصورة الأولى هي الرئيسية. لا تستخدم صورًا منسوخة من الإنترنت.", en: "Use real photos of the item itself; the first photo is the main one. Do not use images copied from the internet." } },
      { title: { ar: "سعر صادق", en: "An honest price" }, body: { ar: "اكتب السعر الحقيقي بالريال العماني أو اتركه فارغًا ليظهر «السعر عند التواصل».", en: "Enter the real price in Omani rials, or leave it empty to show \"Price on request\"." } },
      { title: { ar: "حدّث حالة إعلانك", en: "Keep your listing up to date" }, body: { ar: "أوقف الإعلان مؤقتًا إذا لم تعد السلعة متاحة، أو علّمه «تم البيع» من إعلاناتي.", en: "Pause the listing if the item is unavailable, or mark it \"Sold\" from My Ads." } },
    ],
  },
  "buyer-guidelines": {
    title: { ar: "دليل المشتري", en: "Buyer guidelines" },
    sections: [
      { title: { ar: "اسأل قبل الشراء", en: "Ask before you buy" }, body: { ar: "استخدم المراسلة داخل التطبيق لسؤال البائع عن الحالة والضمان وسبب البيع.", en: "Use in-app messages to ask about condition, warranty and the reason for selling." } },
      { title: { ar: "عاين السلعة", en: "Inspect the item" }, body: { ar: "افحص السلعة بنفسك، وللسيارات اطلب فحصًا فنيًا وتحقق من الملكية.", en: "Check the item yourself; for cars, ask for a technical inspection and verify ownership." } },
      { title: { ar: "ادفع بأمان", en: "Pay safely" }, body: { ar: "لا ترسل دفعات مقدمة لشخص لم تقابله. المنصة لا تحتفظ بالأموال ولا تضمن الصفقات.", en: "Do not send advance payments to someone you have not met. The platform does not hold money or guarantee deals." } },
    ],
  },
  "prohibited-items": {
    title: { ar: "سياسة المواد الممنوعة", en: "Prohibited items policy" },
    intro: { ar: "يُرفض أو يُوقف أي إعلان يتضمن ما يلي، وقد يُوقف الحساب عند التكرار.", en: "Any listing containing the following is rejected or suspended, and repeat offenders may lose their account." },
    sections: [
      { title: { ar: "أسلحة وذخائر ومواد خطرة", en: "Weapons, ammunition and hazardous materials" }, body: { ar: "الأسلحة النارية والبيضاء والذخيرة والمتفجرات والمواد الكيميائية الخطرة.", en: "Firearms, bladed weapons, ammunition, explosives and dangerous chemicals." } },
      { title: { ar: "مخدرات وأدوية", en: "Drugs and medicines" }, body: { ar: "المخدرات والمؤثرات العقلية والأدوية التي تحتاج وصفة طبية.", en: "Narcotics, psychoactive substances and prescription medicines." } },
      { title: { ar: "محتوى للبالغين", en: "Adult content" }, body: { ar: "أي محتوى جنسي أو إباحي أو خدمات مرافقة.", en: "Any sexual or pornographic content, or escort services." } },
      { title: { ar: "وثائق وبيانات", en: "Documents and data" }, body: { ar: "الوثائق الرسمية والجوازات والبطاقات المصرفية والحسابات المسروقة.", en: "Official documents, passports, bank cards and stolen accounts." } },
      { title: { ar: "منتجات مقلدة أو مسروقة", en: "Counterfeit or stolen goods" }, body: { ar: "المنتجات المقلدة أو المسروقة أو المنتهكة لحقوق الملكية.", en: "Counterfeit, stolen or rights-infringing goods." } },
      { title: { ar: "حيوانات محمية", en: "Protected animals" }, body: { ar: "الحيوانات البرية المحمية أو أجزاؤها.", en: "Protected wildlife or parts of protected animals." } },
    ],
  },
};

export const FAQ: { q: Bi; a: Bi }[] = [
  { q: { ar: "كيف أنشر إعلانًا؟", en: "How do I post a listing?" }, a: { ar: "اضغط «أضف إعلان»، اختر القسم، ثم أكمل العنوان والوصف والصور والسعر والموقع، وراجع المعاينة واضغط «تأكيد ونشر».", en: "Tap \"Add listing\", choose a category, fill in the title, description, photos, price and location, review the preview and tap \"Confirm & publish\"." } },
  { q: { ar: "متى يظهر إعلاني؟", en: "When will my listing appear?" }, a: { ar: "يظهر مباشرة بعد الفحص الآلي. إذا فعّلت الإدارة المراجعة المسبقة يظهر بعد موافقة المشرف ويصلك إشعار.", en: "Right after the automatic check. If the administration turns on pre-review, it appears once a moderator approves it and you get a notification." } },
  { q: { ar: "كيف أعدّل إعلاني أو أوقفه؟", en: "How do I edit or pause my listing?" }, a: { ar: "من حسابي ← إعلاناتي، اختر الإعلان واستخدم تعديل أو إيقاف أو إعادة تفعيل أو حذف.", en: "Go to Account → My Ads, pick the listing and use Edit, Pause, Reactivate or Delete." } },
  { q: { ar: "كيف أبلغ عن إعلان أو مستخدم؟", en: "How do I report a listing or a user?" }, a: { ar: "افتح الإعلان واضغط «الإبلاغ عن هذا الإعلان»، أو من المحادثة اضغط رمز العلم، واختر السبب واكتب التفاصيل.", en: "Open the listing and tap \"Report this listing\", or tap the flag in a chat, choose a reason and add details." } },
  { q: { ar: "كيف أنشئ متجرًا؟", en: "How do I create a store?" }, a: { ar: "من حسابي ← متجري، أضف الاسم والشعار والغلاف والوصف. يظهر المتجر بعد موافقة الإدارة، وتظهر إعلاناتك كمنتجات فيه.", en: "Go to Account → My store and add the name, logo, cover and description. The store goes public after approval, and your listings appear as its products." } },
  { q: { ar: "هل يوجد دفع داخل التطبيق؟", en: "Can I pay inside the app?" }, a: { ar: "لا. يتم الاتفاق والدفع مباشرة بين المشتري والبائع، والمنصة لا تحتفظ بالأموال.", en: "No. Buyers and sellers agree and pay each other directly; the platform does not hold money." } },
];

export function getPage(key: string): StaticPage | undefined {
  return PAGES[key];
}
