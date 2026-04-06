export type DisciplineType = "golf" | "accuracy" | "distance" | "scf" | "discathon" | "ddc" | "freestyle";

export type DisciplineKey = "hasGolf" | "hasAccuracy" | "hasDistance" | "hasSCF" | "hasDiscathon" | "hasDDC" | "hasFreestyle";

export type DisciplineMeta = {
  key: DisciplineKey;
  type: DisciplineType;
  label: string;
  icon: string;
  publicSlug: string;
  adminSlug: string;
};

export const disciplineCatalog: DisciplineMeta[] = [
  {
    key: "hasGolf",
    type: "golf",
    label: "Disc golf",
    icon: "tabler:disc-golf",
    publicSlug: "golf",
    adminSlug: "golf",
  },
  {
    key: "hasAccuracy",
    type: "accuracy",
    label: "Accuracy",
    icon: "tabler:target",
    publicSlug: "accuracy",
    adminSlug: "accuracy",
  },
  {
    key: "hasDistance",
    type: "distance",
    label: "Distance",
    icon: "tabler:route-2",
    publicSlug: "distance",
    adminSlug: "distance",
  },
  {
    key: "hasSCF",
    type: "scf",
    label: "SCF",
    icon: "tabler:wind",
    publicSlug: "self-caught-flight",
    adminSlug: "scf",
  },
  {
    key: "hasDiscathon",
    type: "discathon",
    label: "Discathon",
    icon: "tabler:run",
    publicSlug: "discathon",
    adminSlug: "discathon",
  },
  {
    key: "hasDDC",
    type: "ddc",
    label: "DDC",
    icon: "tabler:users-group",
    publicSlug: "double-disc-court",
    adminSlug: "ddc",
  },
  {
    key: "hasFreestyle",
    type: "freestyle",
    label: "Freestyle",
    icon: "tabler:play-handball",
    publicSlug: "freestyle",
    adminSlug: "freestyle",
  },
];

export const disciplineByKey = disciplineCatalog.reduce<Record<DisciplineKey, DisciplineMeta>>((acc, discipline) => {
  acc[discipline.key] = discipline;
  return acc;
}, {} as Record<DisciplineKey, DisciplineMeta>);

export const disciplineByType = disciplineCatalog.reduce<Record<DisciplineType, DisciplineMeta>>((acc, discipline) => {
  acc[discipline.type] = discipline;
  return acc;
}, {} as Record<DisciplineType, DisciplineMeta>);

export const disciplineKeyOrder = disciplineCatalog.map(discipline => discipline.key);

export function useDisciplineCatalog() {
  return {
    disciplineCatalog,
    disciplineByKey,
    disciplineByType,
    disciplineKeyOrder,
  };
}
