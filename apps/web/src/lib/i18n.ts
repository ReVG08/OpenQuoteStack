export type Locale = "en" | "pt-BR";
const en = {
  tagline: "The open-source stack for branded instant quotes.",
  subtitle:
    "Create pricing estimators, self-host your stack, and keep control of your customer data.",
  login: "Log in",
  register: "Create account",
  logout: "Log out",
  demo: "Try the moving calculator",
  dashboard: "Workspace",
  theme: "Theme",
  name: "Name",
  email: "Email",
  password: "Password",
  submit: "Continue",
  working: "Working…",
  authError:
    "Could not complete authentication. Check your details and try again.",
  organizations: "Your organizations",
  createOrganization: "Create organization",
  organizationName: "Organization name",
  slug: "Slug",
  locale: "Language",
  timezone: "Timezone",
  currency: "Currency",
  create: "Create",
  empty: "No estimators yet. Start with the moving template.",
  importMoving: "Add moving template",
  estimators: "Estimators",
  revision: "Revision",
  publish: "Publish revision",
  published: "Published",
  draft: "Draft",
  archived: "Archived",
  back: "Back to workspace",
  saveRevision: "Create revision",
  definition: "Portable definition",
  revisionHelp:
    "Save a new immutable snapshot. Publishing switches the revision used for estimates; older estimates keep their original calculation.",
  saved: "Estimate saved",
  calculate: "Calculate estimate",
  saveEstimate: "Calculate and save",
  inputs: "Tell us about your move",
  estimate: "Estimated total",
  subtotal: "Subtotal",
  disclaimer:
    "A planning estimate. Confirm access, inventory and service details with the mover.",
  preview: "Engine playground",
  previewHelp:
    "Manual distance, exact pricing and an itemized result. This demo runs locally in your browser.",
  error: "Check the inputs and try again.",
  failure: "The operation could not be completed. Check your access and input.",
  origin: "Origin",
  destination: "Destination",
  bedrooms: "Bedrooms",
  distance: "Distance (miles)",
  elevator: "Elevator available",
  floors: "Flights of stairs",
  boxes: "Boxes",
  piano: "Piano handling",
  packing: "Packing required",
  moving_date: "Moving date",
  range: "Estimated range",
  noPublished: "Publish a revision before saving estimates.",
};
const pt: typeof en = {
  tagline:
    "O stack de código aberto para orçamentos instantâneos com a sua marca.",
  subtitle:
    "Crie calculadoras de preços, hospede sua plataforma e mantenha o controle dos dados dos seus clientes.",
  login: "Entrar",
  register: "Criar conta",
  logout: "Sair",
  demo: "Testar a calculadora de mudança",
  dashboard: "Área de trabalho",
  theme: "Tema",
  name: "Nome",
  email: "E-mail",
  password: "Senha",
  submit: "Continuar",
  working: "Aguarde…",
  authError:
    "Não foi possível autenticar. Confira seus dados e tente novamente.",
  organizations: "Suas organizações",
  createOrganization: "Criar organização",
  organizationName: "Nome da organização",
  slug: "Identificador",
  locale: "Idioma",
  timezone: "Fuso horário",
  currency: "Moeda",
  create: "Criar",
  empty: "Ainda não há calculadoras. Comece com o modelo de mudança.",
  importMoving: "Adicionar modelo de mudança",
  estimators: "Calculadoras",
  revision: "Revisão",
  publish: "Publicar revisão",
  published: "Publicada",
  draft: "Rascunho",
  archived: "Arquivada",
  back: "Voltar à área de trabalho",
  saveRevision: "Criar revisão",
  definition: "Definição portátil",
  revisionHelp:
    "Salve uma nova versão imutável. A publicação troca a versão usada nos orçamentos; os anteriores mantêm seu cálculo original.",
  saved: "Orçamento salvo",
  calculate: "Calcular orçamento",
  saveEstimate: "Calcular e salvar",
  inputs: "Conte sobre sua mudança",
  estimate: "Total estimado",
  subtotal: "Subtotal",
  disclaimer:
    "Estimativa para planejamento. Confirme acesso, inventário e detalhes do serviço com a empresa.",
  preview: "Demonstração do motor",
  previewHelp:
    "Distância manual, preços exatos e resultado detalhado. Esta demonstração roda localmente no seu navegador.",
  error: "Confira os dados e tente novamente.",
  failure:
    "Não foi possível concluir a operação. Confira seu acesso e os dados informados.",
  origin: "Origem",
  destination: "Destino",
  bedrooms: "Quartos",
  distance: "Distância (milhas)",
  elevator: "Elevador disponível",
  floors: "Lances de escada",
  boxes: "Caixas",
  piano: "Transporte de piano",
  packing: "Embalagem necessária",
  moving_date: "Data da mudança",
  range: "Faixa estimada",
  noPublished: "Publique uma revisão antes de salvar orçamentos.",
};
export const messages = (locale: Locale) => (locale === "pt-BR" ? pt : en);
export const getLocale = (value: unknown): Locale =>
  value === "pt-BR" ? "pt-BR" : "en";
export function formatMoney(
  amountMinor: number | bigint,
  currency: string,
  minorUnits: number,
  locale: Locale,
) {
  const amount = BigInt(amountMinor),
    scale = 10n ** BigInt(minorUnits);
  const whole = amount / scale,
    fraction = (amount < 0n ? -amount : amount) % scale;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  })
    .formatToParts(whole === 0n && amount < 0n ? -0 : whole)
    .map((part) =>
      part.type === "fraction"
        ? fraction.toString().padStart(minorUnits, "0")
        : part.value,
    )
    .join("");
}
