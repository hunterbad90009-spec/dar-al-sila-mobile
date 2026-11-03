/**
 * Category-specific listing fields (spec 4.2 / 4.5). Each top-level category slug gets its
 * own fields; values are stored in listings.attributes (jsonb) under the field key.
 * Labels are Arabic source strings translated through t().
 */
export type FieldType = "text" | "number" | "select";

export type CategoryField = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  unit?: string;
  required?: boolean;
  filterable?: boolean;
};

const yesNo = [
  { value: "yes", label: "نعم" },
  { value: "no", label: "لا" },
];

export const CATEGORY_FIELDS: Record<string, CategoryField[]> = {
  cars: [
    { key: "make", label: "الماركة", type: "text", required: true, filterable: true },
    { key: "model", label: "الموديل", type: "text", required: true },
    { key: "year", label: "سنة الصنع", type: "number", required: true, filterable: true },
    { key: "mileage", label: "المسافة المقطوعة", type: "number", unit: "كم" },
    {
      key: "transmission", label: "ناقل الحركة", type: "select", filterable: true,
      options: [{ value: "automatic", label: "أوتوماتيك" }, { value: "manual", label: "عادي" }],
    },
    {
      key: "fuel", label: "نوع الوقود", type: "select",
      options: [{ value: "petrol", label: "بنزين" }, { value: "diesel", label: "ديزل" }, { value: "hybrid", label: "هجين" }, { value: "electric", label: "كهربائي" }],
    },
  ],
  "real-estate": [
    {
      key: "property_type", label: "نوع العقار", type: "select", required: true, filterable: true,
      options: [
        { value: "apartment", label: "شقة" }, { value: "villa", label: "فيلا" }, { value: "land", label: "أرض" },
        { value: "office", label: "مكتب" }, { value: "shop", label: "محل" }, { value: "building", label: "عمارة" }, { value: "farm", label: "مزرعة أو استراحة" },
      ],
    },
    { key: "area", label: "المساحة", type: "number", unit: "م²", required: true },
    { key: "rooms", label: "عدد الغرف", type: "number", filterable: true },
    { key: "bathrooms", label: "عدد دورات المياه", type: "number" },
    { key: "furnished", label: "مفروش", type: "select", options: yesNo },
  ],
  electronics: [
    { key: "brand", label: "الماركة", type: "text", required: true, filterable: true },
    { key: "model", label: "الموديل", type: "text" },
    { key: "specs", label: "المواصفات", type: "text" },
    { key: "warranty", label: "عليه ضمان", type: "select", options: yesNo },
  ],
  services: [
    { key: "service_type", label: "نوع الخدمة", type: "text", required: true, filterable: true },
    { key: "service_area", label: "منطقة تقديم الخدمة", type: "text" },
    { key: "availability", label: "أوقات العمل", type: "text" },
  ],
  jobs: [
    {
      key: "job_type", label: "نوع الوظيفة", type: "select", required: true, filterable: true,
      options: [{ value: "full_time", label: "دوام كامل" }, { value: "part_time", label: "دوام جزئي" }, { value: "contract", label: "عقد" }, { value: "remote", label: "عن بعد" }],
    },
    { key: "experience", label: "سنوات الخبرة", type: "number" },
    { key: "company", label: "الجهة", type: "text" },
  ],
};

// Electronics-like categories share the electronics fields.
CATEGORY_FIELDS["mobiles-tablets"] = CATEGORY_FIELDS.electronics;
CATEGORY_FIELDS.computers = CATEGORY_FIELDS.electronics;
CATEGORY_FIELDS.gaming = CATEGORY_FIELDS.electronics;

export function fieldsForCategory(topSlug: string | null | undefined): CategoryField[] {
  return (topSlug && CATEGORY_FIELDS[topSlug]) || [];
}

export const CONDITIONS = [
  { value: "new", label: "جديد" },
  { value: "used", label: "مستعمل" },
  { value: "refurbished", label: "مجدد" },
] as const;

export type Condition = (typeof CONDITIONS)[number]["value"];

/** Categories where item condition does not apply. */
export const NO_CONDITION_SLUGS = new Set(["jobs", "services", "real-estate", "pets"]);
